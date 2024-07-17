import api from "api";
require("dotenv").config(); // load .env variables
import { Router } from "express"; // import router from express
import * as isoCountries from "i18n-iso-countries";
import CustomRequest from "./CustomRequest";
import https from "https";
import fs from "fs";
import csv from "csv-parser";

interface Country {
  Country: string;
  "Alpha-2 code": string;
  "Alpha-3 code": string;
  "Numeric code": string;
  "Latitude (average)": number;
  "Longitude (average)": number;
}
const countries: Country[] = [];

// Function to read the CSV file and parse it
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
      .on("end", () => {
        resolve();
      })
      .on("error", (error) => {
        reject(error);
      });
  });
};
// Function to get the latitude and longitude of a given country code
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

// Function to perform the GET request
function getPostcodeData(postcode: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.postcodes.io",
      path: `/postcodes/${postcode}`,
      method: "GET",
    };

    const req = https.request(options, (res) => {
      let data = "";

      // A chunk of data has been received
      res.on("data", (chunk) => {
        data += chunk;
      });

      // The whole response has been received
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(
            new Error(`Request failed with status code ${res.statusCode}`)
          );
        }
      });
    });

    // Handle request errors
    req.on("error", (e) => {
      reject(e);
    });

    // End the request
    req.end();
  });
}

const { SEARCHING_API_KEY = "none" } = process.env;

const router = Router(); // create router to create route bundle

const sdk = api("@fsq-developer/v1.0#18rps1flohmmndw");

sdk.auth(SEARCHING_API_KEY);

function getCountry(country: string): string {
  const upperCountry = country.toUpperCase();
  // Iterate through all country codes and names to find a match
  for (const countryCode of Object.keys(isoCountries.getNames("en"))) {
    const countryName =
      isoCountries.getName(countryCode, "en") ?? "".toUpperCase();

    // Check if the country code or name is present in the search query
    if (
      countryName != "" &&
      (upperCountry.includes(" " + countryCode + " ") ||
        upperCountry.includes(countryName))
    ) {
      return countryCode;
    }
  }
  return "GB";
}

router.get("/search", async (req: any, res) => {
  try {
    const { Geonames, Altnames } = (req as CustomRequest).context.models;
    const query = JSON.parse(req.headers.terms);

    if (query.postcode != null) {
      getPostcodeData(query.postcode)
        .then((data) => {
          console.log("Postcode data:", data);
          return res.json({ lng: data.longitude, lat: data.latitude });
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
    if (query.name != null) {
      if (query.town != null) {
        const results = await Geonames.findOne({
          name: query.town,
          countryCode: getCountry(query.country),
        }).lean();
        console.log(results.location);
        if (
          results != null &&
          results.location != null &&
          results.location.coordinates != null &&
          results.location.coordinates.length == 2
        ) {
          const data = await sdk.placeSearch({
            query: query.name,
            radius: 54000,
            ll: `${results.location.coordinates[1]}%2C${results.location.coordinates[0]}`,
          });
          return res.json(data);
        } else {
          return res
            .status(404)
            .json({ error: "ERROR: Town could not be found" });
        }
      } else {
        if (query.country != null) {
          await loadCSV("../assets/country-coord.csv");
          const result = getLatLong(getCountry(query.country));
          if (result) {
            sdk
              .placeSearch({
                query: query.name,
                radius: 100000,
                ll: `${result.longitude}%2C${result.latitude}`,
              })
              .then(({ data }: any) => {
                return res.json(data);
              })
              .catch((err: any) => {
                return res.json(err);
              });
          } else {
            res.status(404).json({ error: "ERROR: Country Not Found" });
          }
        } else {
          const data = await sdk.placeSearch({
            query: query.name,
            radius: 100000,
          });
          return res.json(data);
        }
      }
    } else {
      if (query.town != null) {
        if (query.country != null) {
          await loadCSV("./src/assets/country-coord.csv");
          const result = getLatLong(getCountry(query.country));
          if (result) {
            const data = await sdk.placeSearch({
              query: query.town,
              radius: 100000,
              ll: `${result.latitude}%2C${result.longitude}`,
            });
            return res.json(data);
          } else {
            return res.status(404).json({ error: "ERROR: Country Not Found." });
          }
        } else {
          const data = await sdk.placeSearch({
            query: query.town,
            radius: 100000,
          });
          return res.json(data);
        }
      } else {
        if (query.country != null) {
          await loadCSV("./src/assets/country-coord.csv");
          const result = getLatLong(getCountry(query.country));
          if (result) {
            return res.json({ lat: result.latitude, lng: result.longitude });
          } else {
            return res.status(404).json({ error: "ERROR: Country Not Found" });
          }
        } else {
          return res
            .status(400)
            .json({ error: "ERROR: Please Provide Valid Search Flags" });
        }
      }
    }
    return res.status(500).json({ error: "End Reached" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error });
  }
});

export default router;
