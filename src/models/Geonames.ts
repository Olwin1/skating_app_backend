// Change the import statement to import only Schema
import mongoose from "../db/connection";

// Defining the Geoname interface with required properties
interface IGeoname {
    name: string,
    asciiname: string,
    location: Object,
    featureClass: string,
    countryCode: string,
    admin1Code: string,
    admin2Code: string,
    admin3Code: string,
    admin4Code: string,
    population: number,

    timezone: string,
    geoJson: Object
}

// Creating a new Geoname schema using the interface created above
const GeonameSchema: mongoose.Schema<IGeoname> = new mongoose.Schema({
    name: { type: String },
    asciiname: { type: String },
    location: { type: String },
    featureClass: { type: String },
    countryCode: { type: String },
    admin1Code: { type: String },
    admin2Code: { type: String },
    admin3Code: { type: String },
    admin4Code: { type: String },
    population: { type: Number },

    timezone: { type: String },
    geoJson: { type: String }
});

// Creating a Geoname model using the Geoname schema
const Geoname = mongoose.model<IGeoname>("Geoname", GeonameSchema);

// Exporting the Geoname model
export default Geoname;