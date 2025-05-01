// Import necessary modules and libraries
import api from "api";
import dotenv from "dotenv";
import { Response, Router } from "express";
import * as isoCountries from "i18n-iso-countries";

import https from "https";
import fs from "fs";
import csv from "csv-parser";
import mongoose from "../db/connection";
import { CustomRequest } from "express-override";

// Load environment variables from .env file
dotenv.config();

// Define an interface for the Country data
interface Country {
  Country: string;
  "Alpha-2 code": string;
  "Alpha-3 code": string;
  "Numeric code": string;
  "Latitude (average)": number;
  "Longitude (average)": number;
}

// Create an empty array to hold country data
const countries: Country[] = [];

// Function to load country data from a CSV file
const loadCSV = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        countries.push({
          Country: row.Country,
          "Alpha-2 code": row["Alpha-2 code"],
          "Alpha-3 code": row["Alpha-3 code"],
          "Numeric code": row["Numeric code"],
          "Latitude (average)": parseFloat(row["Latitude (average)"]),
          "Longitude (average)": parseFloat(row["Longitude (average)"]),
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });
};

// Function to get latitude and longitude by country code
const getLatLong = (
  code: string
): { latitude: number; longitude: number } | null => {
  const country = countries.find(
    (country) =>
      country["Alpha-2 code"] === code || country["Alpha-3 code"] === code
  );
  if (country) {
    return {
      latitude: country["Latitude (average)"],
      longitude: country["Longitude (average)"],
    };
  }
  return null;
};

// Function to get postcode data from an API
const getPostcodeData = (postcode: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.postcodes.io",
      path: `/postcodes/${postcode}`,
      method: "GET",
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          resolve({
            lat: result.result.latitude,
            lng: result.result.longitude,
          });
        } else {
          reject(
            new Error(`Request failed with status code ${res.statusCode}`)
          );
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
};

// Load the API key from environment variables
const SEARCHING_API_KEY = process.env.SEARCHING_API_KEY || "none";
// Initialize the API SDK with the key
const sdk = api("@fsq-developer/v1.0#18rps1flohmmndw");
sdk.auth(SEARCHING_API_KEY);

// Function to get the country code from country name
const getCountry = (country: string): string => {
  const upperCountry = country.toUpperCase();
  for (const countryCode of Object.keys(isoCountries.getNames("en"))) {
    const countryName =
      isoCountries.getName(countryCode, "en")?.toUpperCase() || "";
    if (
      countryName &&
      (upperCountry.includes(" " + countryCode + " ") ||
        upperCountry.includes(countryName))
    ) {
      return countryCode;
    }
  }
  return "GB";
};

// Function to search by postcode and return coordinates
const searchByPostcode = async (postcode: string, res: Response) => {
  try {
    const data = await getPostcodeData(postcode);
    return { lng: data.lng, lat: data.lat };
  } catch (error) {
    console.error("Error:", error);
    throw Error("Failed to fetch postcode data");
  }
};

// Function to search by town and return data
const searchByTown = async (
  town: string,
  country: string,
  Geonames: any,
  res: any
) => {
  try {
    const code = country ? getCountry(country) : undefined;
    //TODO Support altnames
    const results = await Geonames.find({
      $or: [{ name: town }, { asciiname: town }],
    }).lean();
    if (results && results.length != 0) {
      let highestPop = 0;
      let latlong = { lat: null, lng: null };
      if (code) {
        for (let result of results) {
          if (code == result.countryCode) {
            if (result.population > highestPop) {
              latlong.lat = result.location.coordinates[1];
              latlong.lng = result.location.coordinates[0];
              highestPop = result.population;
            }
          }
        }
      } else {
        for (let result of results) {
          if (result.population > highestPop) {
            latlong.lat = result.location.coordinates[1];
            latlong.lng = result.location.coordinates[0];
            highestPop = result.population;
          }
        }
      }
      return latlong;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
    throw Error("Failed to fetch town data");
  }
};

// Function to search by country and return data
const searchByCountry = async (country: string, res: Response) => {
  try {
    await loadCSV("./src/assets/country-coord.csv");
    const result = getLatLong(getCountry(country));
    if (result) {
      return result;
    } else {
      throw Error("ERROR: No Records Found");
    }
  } catch (error) {
    console.error("Error:", error);
    throw Error(`Failed to fetch country data. ${error}`);
  }
};

// Function to handle search requests
const handleSearch = async (req: CustomRequest, res: Response) => {
  try {
    const { Geonames } = req.context!.models as mongoose.Models;
    const query = JSON.parse(req.body.terms);
    let result;

    if (query.postcode) {
      result = await searchByPostcode(query.postcode, res);
    } else if (query.town) {
      result = await searchByTown(query.town, query.country, Geonames, res);
      if (query.name) {
        // Search by name otherwise return result
      }
    } else if (query.country) {
      // No postcode, no town, maybe a name? check
      result = await searchByCountry(query.country, res);
      // if(query.name) {
      //   const data = await sdk.placeSearch({
      //     query: query.name,
      //     radius: 100000,
      //   });
      // }

      // // -------------------------------------------
      // //
      // //
      // //
      // //
      // // TODO Figure out what to do here D:
      // const data = await sdk.placeSearch({
      //   query: query.name,
      //   radius: 100000,
      // });
      // if (
      //   data != null &&
      //   data.data != null &&
      //   data.data.results != null &&
      //   data.data.results.length > 0
      // ) {
      //   let ll = {
      //     lat: Object.values(data.data.results[0].geocodes as object)[0]
      //       .latitude,
      //     lng: Object.values(data.data.results[0].geocodes as object)[0]
      //       .longitude,
      //   };
      //   for (const result of data.data.results) {
      //     if (
      //       result.location.name
      //         .toUpperCase()
      //         .includes(query.name.toUpperCase())
      //     ) {
      //       ll = {
      //         lat: Object.values(result.geocodes as object)[0].latitude,
      //         lng: Object.values(result.geocodes as object)[0].longitude,
      //       };
      //       break;
      //     }
      //   }
      //   //
      //   //
      //   //
      //   //
      //   //
      //   // -------------------------------------------
    }

    // Return result
    if (result) {
      return res.json(result);
    } else {
      return res.status(404).json({ error: "ERROR: No Records Found" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error });
  }
};

// Create an Express router and define the search route
const router = Router();
router.post("/search", handleSearch);

// Export the router for use in the main application
export default router;
