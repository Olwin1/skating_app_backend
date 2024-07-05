import api from 'api';
require("dotenv").config(); // load .env variables
import { Router } from "express" // import router from express
import * as isoCountries from 'i18n-iso-countries';
import mongoose from "../db/connection";
import CustomRequest from './CustomRequest';


const { SEARCHING_API_KEY = "none" } = process.env;

const router = Router(); // create router to create route bundle

const sdk = api('@fsq-developer/v1.0#18rps1flohmmndw');

sdk.auth(SEARCHING_API_KEY);
const suffixes = ["terrace",
    "court",
    "plaza",
    "alley",
    "crescent",
    "square",
    "lane",
    "way",
    "avenue",
    "street",
    "road",
    "drive",
    "grove",
    "gardens",
    "place",
    "close",
    "hill",
    "circus",
    "mews",
    "vale",
    "dene",
    "rise",
    "mead",
    "yard",
    "path",
    "walk",
    "pathway",
    "esplanade",
    "promenade",
    "trail",
    "boulevard",
    "row",
    "passage",
    "quay",
    "point",
    "view",
    "loop",
    "trace",
    "green",
    "chase",
    "brook",
    "landing",
    "ridge",
    "wood",
    "field",
    "springs",
    "run",
    "pointe",
    "crossing",
    "harbor",
    "glen",
    "hollow",
    "knoll",
    "manor",
    "summit",
    "orchard",
    "common",
    "haven",
    "shores",
    "port",
    "key",
    "strand",
    "quays",
    "vista",
    "new"];



function extractCountry(searchQuery: string): [string, string | null] | null {
    // Initialize the country names map
    isoCountries.registerLocale(require("i18n-iso-countries/langs/en.json"));

    // Convert the search query to uppercase for case-insensitive matching
    const normalizedSearchQuery = searchQuery.toUpperCase();

    // Iterate through all country codes and names to find a match
    for (const countryCode of Object.keys(isoCountries.getNames('en'))) {
        const countryName = isoCountries.getName(countryCode, 'en') ?? "".toUpperCase();

        // Check if the country code or name is present in the search query
        if (
            countryName != "" && (normalizedSearchQuery.includes(" " + countryCode + " ") ||
                normalizedSearchQuery.includes(countryName))
        ) {
            let retval: string | null = normalizedSearchQuery.replace(countryCode, "").replace(countryName, "").trim();
            if (retval == "") {
                retval = null;
            }
            return [countryCode, retval];
        }
    }

    // No match found
    return null;
}


function containsNumber(input: string): boolean {
    // Use the Number constructor to attempt conversion to a number
    // If successful, it's a number
    return !isNaN(Number(input));
}

// Route to create a new channel with the specified participants
router.get("/search/:place", async (req: any, res) => {
    const { Geonames, Altnames } = (req as CustomRequest).context.models;
    const query = req.params.place;
    let searchLocation = null;
    const a = extractCountry(query);
    const countryCode = a != null ? a[0] : null
    if (a != null && a[1] == null && a[0] != null) {
        // set search location to country
    }
    else if (a != null && a[1] != null && a[0] != null) {
        const remainingQuery = a[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const remainingQueryArr = remainingQuery.split(" ");
        let searchableWords: string[] = []
        for (var word of remainingQueryArr) {
            if (!containsNumber(word)) {
                if (word.toLowerCase() in suffixes) {
                    searchableWords = [];
                }
                else {
                    searchableWords.push(word)
                }
            }
        }
        for (var word of searchableWords) {
            const resa = await Geonames.find({ asciiname: new RegExp(word, 'i') });
            const aas = resa;
        }
    }
    else {
        // search using current location
    }


    sdk.placeSearch({ query: query, radius: 100000 })
        .then(({ data }: any) => { return res.json(data) })
        .catch((err: any) => { return res.json(err) });
});


export default router;
