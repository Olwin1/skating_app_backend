// Import necessary modules and libraries
import api from "api";
import dotenv from "dotenv";
import { Router } from "express";
import * as isoCountries from "i18n-iso-countries";
import CustomRequest from "./CustomRequest";
import https from "https";
import fs from "fs";
import csv from "csv-parser";

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
const searchByPostcode = async (postcode: string, res: any) => {
  try {
    const data = await getPostcodeData(postcode);
    res.json({ lng: data.lng, lat: data.lat });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch postcode data" });
  }
};

// Function to search by town and return data
const searchByTown = async (
  town: string,
  country: string,
  queryName: string,
  Geonames: any,
  res: any
) => {
  try {
    const code = getCountry(country);
    const results = await Geonames.findOne({
      name: town,
      countryCode: code,
    }).lean();
    if (
      results &&
      results.location &&
      results.location.coordinates &&
      results.location.coordinates.length === 2
    ) {
      const data = await sdk.placeSearch({
        query: queryName,
        radius: 54000,
        ll: `${results.location.coordinates[1]}%2C${results.location.coordinates[0]}`,
      });
      if (
        data != null &&
        data.data != null &&
        data.data.results != null &&
        data.data.results.length > 0
      ) {
        let ll = {
          lat: Object.values(data.data.results[0].geocodes as object)[0]
            .latitude,
          lng: Object.values(data.data.results[0].geocodes as object)[0]
            .longitude,
        };
        for (const result of data.data.results) {
          if (result.location.country.toUpperCase() == code.toUpperCase()) {
            ll = {
              lat: Object.values(result.geocodes as object)[0].latitude,
              lng: Object.values(result.geocodes as object)[0].longitude,
            };
            break;
          }
        }
        res.json(ll);
      } else {
        res.status(404).json({ error: "ERROR: No Records Found" });
      }
    } else {
      res.status(404).json({ error: "ERROR: Town could not be found" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch town data" });
  }
};

// Function to search by country and return data
const searchByCountry = async (
  country: string,
  queryName: string,
  res: any,
  isTown: boolean
) => {
  try {
    await loadCSV("./src/assets/country-coord.csv");
    const result = getLatLong(getCountry(country));
    if (result) {
      if (queryName == "") {
        res.json({ lat: result.latitude, lng: result.longitude });
      } else {
        const data = await sdk.placeSearch({
          query: queryName,
          radius: 100000,
          ll: `${result.latitude}%2C${result.longitude}`,
        });
        if (
          data != null &&
          data.data != null &&
          data.data.results != null &&
          data.data.results.length > 0
        ) {
          let ll = {
            lat: Object.values(data.data.results[0].geocodes as object)[0]
              .latitude,
            lng: Object.values(data.data.results[0].geocodes as object)[0]
              .longitude,
          };
          if (isTown) {
            for (const result of data.data.results) {
              if (
                result.location.post_town.toUpperCase() ==
                queryName.toUpperCase()
              ) {
                ll = {
                  lat: Object.values(result.geocodes as object)[0].latitude,
                  lng: Object.values(result.geocodes as object)[0].longitude,
                };
                break;
              }
            }
          }
          res.json(ll);
        } else {
          res.status(404).json({ error: "ERROR: No Records Found" });
        }
      }
    } else {
      res.status(404).json({ error: "ERROR: Country Not Found" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch country data" });
  }
};

// Function to handle search requests
const handleSearch = async (req: any, res: any) => {
  try {
    const { Geonames } = (req as CustomRequest).context.models;
    const query = JSON.parse(req.headers.terms);

    if (query.postcode) {
      await searchByPostcode(query.postcode, res);
      return;
    } else if (query.name) {
      if (query.town) {
        await searchByTown(
          query.town,
          query.country,
          query.name,
          Geonames,
          res
        );
        return;
      } else if (query.country) {
        await searchByCountry(query.country, query.name, res, false);
        return;
      } else {
        const data = await sdk.placeSearch({
          query: query.name,
          radius: 100000,
        });
        if (
          data != null &&
          data.data != null &&
          data.data.results != null &&
          data.data.results.length > 0
        ) {
          let ll = {
            lat: Object.values(data.data.results[0].geocodes as object)[0]
              .latitude,
            lng: Object.values(data.data.results[0].geocodes as object)[0]
              .longitude,
          };
          for (const result of data.data.results) {
            if (
              result.location.name
                .toUpperCase()
                .includes(query.name.toUpperCase())
            ) {
              ll = {
                lat: Object.values(result.geocodes as object)[0].latitude,
                lng: Object.values(result.geocodes as object)[0].longitude,
              };
              break;
            }
          }
          res.json(ll);
          return;
        } else {
          res.status(404).json({ error: "ERROR: No Records Found" });
          return;
        }
      }
    } else if (query.town) {
      if (query.country) {
        await searchByCountry(query.country, query.town, res, true);
        return;
      } else {
        const data = await sdk.placeSearch({
          query: query.town,
          radius: 100000,
        });
        if (
          data != null &&
          data.data != null &&
          data.data.results != null &&
          data.data.results.length > 0
        ) {
          let ll = {
            lat: Object.values(data.data.results[0].geocodes as object)[0]
              .latitude,
            lng: Object.values(data.data.results[0].geocodes as object)[0]
              .longitude,
          };
          for (const result of data.data.results) {
            if (
              result.location.post_town.toUpperCase() ==
              query.town.toUpperCase()
            ) {
              ll = {
                lat: Object.values(result.geocodes as object)[0].latitude,
                lng: Object.values(result.geocodes as object)[0].longitude,
              };
              break;
            }
          }
          res.json(ll);
          return;
        } else {
          res.status(404).json({ error: "ERROR: No Records Found" });
          return;
        }
      }
    } else if (query.country) {
      await searchByCountry(query.country, "", res, false);
      return
    } else {
      res
        .status(400)
        .json({ error: "ERROR: Please Provide Valid Search Flags" });
        return;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error });
    return;
  }
};

// Create an Express router and define the search route
const router = Router();
router.get("/search", handleSearch);

// Export the router for use in the main application
export default router;
