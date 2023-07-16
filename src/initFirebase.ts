import firebase from "firebase-admin"
// Best practice: Get the credential file and db url from environment varible
import serviceAccount from "../patinka-657-firebase-adminsdk-qok33-ef34cae9ac.json" ;

export default () => {
  firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount  as firebase.ServiceAccount),
  });
  console.info("Initialized Firebase SDK");
};