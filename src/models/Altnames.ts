// Change the import statement to import only Schema
import mongoose from "../db/connection";

// Defining the Altname interface with required properties
interface IAltname {
  AltnameId: number;
  isoLang: string;
  altName: string;
  isPreferred: boolean;
  isShort: boolean;
  isColloquial: boolean;
  isHistoric: boolean;
}

// Creating a new Altname schema using the interface created above
const AltnameSchema: mongoose.Schema<IAltname> = new mongoose.Schema({
  AltnameId: { type: Number },
  isoLang: { type: String },
  altName: { type: String },
  isPreferred: { type: Boolean },
  isShort: { type: Boolean },
  isColloquial: { type: Boolean },
  isHistoric: { type: Boolean },
});

// Creating a Altname model using the Altname schema
const Altname = mongoose.model<IAltname>("Altname", AltnameSchema);

// Exporting the Altname model
export default Altname;
