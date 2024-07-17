import api from "api";
import dotenv from "dotenv";
import { Router } from "express";
import * as isoCountries from "i18n-iso-countries";
import CustomRequest from "./CustomRequest";
import https from "https";
import fs from "fs";
import csv from "csv-parser";

dotenv.config();

interface Country {
  Country: string;
  "Alpha-2 code": string;
  "Alpha-3 code": string;
  "Numeric code": string;
  "Latitude (average)": number;
  "Longitude (average)": number;
}
const countries: Country[] = [];

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
          resolve(JSON.parse(data));
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

const SEARCHING_API_KEY = process.env.SEARCHING_API_KEY || "none";
const sdk = api("@fsq-developer/v1.0#18rps1flohmmndw");
sdk.auth(SEARCHING_API_KEY);

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

const searchByPostcode = async (postcode: string, res: any) => {
  try {
    const data = await getPostcodeData(postcode);
    res.json({ lng: data.result.longitude, lat: data.result.latitude });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch postcode data" });
  }
};

const searchByTown = async (
  town: string,
  country: string,
  queryName: string,
  Geonames: any,
  res: any
) => {
  try {
    const results = await Geonames.findOne({
      name: town,
      countryCode: getCountry(country),
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
      res.json(data);
    } else {
      res.status(404).json({ error: "ERROR: Town could not be found" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch town data" });
  }
};

const searchByCountry = async (
  country: string,
  queryName: string,
  res: any
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
        res.json(data);
      }
    } else {
      res.status(404).json({ error: "ERROR: Country Not Found" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to fetch country data" });
  }
};

const handleSearch = async (req: any, res: any) => {
  try {
    const { Geonames } = (req as CustomRequest).context.models;
    const query = JSON.parse(req.headers.terms);

    if (query.postcode) {
      await searchByPostcode(query.postcode, res);
    } else if (query.name) {
      if (query.town) {
        await searchByTown(
          query.town,
          query.country,
          query.name,
          Geonames,
          res
        );
      } else if (query.country) {
        await searchByCountry(query.country, query.name, res);
      } else {
        const data = await sdk.placeSearch({
          query: query.name,
          radius: 100000,
        });
        res.json(data);
      }
    } else if (query.town) {
      if (query.country) {
        await searchByCountry(query.country, query.town, res);
      } else {
        const data = await sdk.placeSearch({
          query: query.town,
          radius: 100000,
        });
        res.json(data);
      }
    } else if (query.country) {
      await searchByCountry(query.country, "", res);
    } else {
      res
        .status(400)
        .json({ error: "ERROR: Please Provide Valid Search Flags" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error });
  }
};

const router = Router();
router.get("/search", handleSearch);

export default router;
