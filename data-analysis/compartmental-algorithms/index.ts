import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import stateCodes from "us-state-codes";

interface SEIRDataPoint {
  time: number;
  S: number;
  E: number;
  I: number;
  R: number;
}

interface CountiesCsv {
  STATE: string;
  STATEFP: string;
  COUNTYFP: string;
  COUNTYNS: string;
  COUNTYNAME: string;
  CLASSFP: string;
  FUNCSTAT: string;
}

interface SEIRParameters {
  beta: number; // Transmission rate
  sigma: number; // Rate of progression from exposed to infectious (1/incubation period)
  gamma: number; // Recovery rate (1/infectious period)
  population: number; // Total population
}

interface CountyInfectionData {
  county: string;
  infected: number;
  state: string;
}

interface CountyData {
  [countyName: string]: SEIRDataPoint[];
}

const getCountyCode = async (state: string, userCounty: string) => {
  const counties = await readCountiesFromCsv("counties.csv");
  const cleanedUserCountyName = cleanString(userCounty);
  let cleanedCountyName;
  for (const county of counties) {
    cleanedCountyName = cleanString(county.COUNTYNAME);
    if (
      (cleanedCountyName === cleanedUserCountyName ||
        cleanedCountyName === `${cleanedUserCountyName} county` ||
        cleanedCountyName === `${cleanedUserCountyName} parish`) &&
      county.STATE === state
    ) {
      return county.COUNTYNS;
    }
  }
  console.log("Could not find county");
  throw new Error("county not found");
};

async function readInitialInfectedFromCSV(
  filePath: string,
): Promise<CountyInfectionData[]> {
  return new Promise((resolve, reject) => {
    const countyData: CountyInfectionData[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: any) => {
        // Assuming your CSV has a column named 'InitialInfected' or similar.
        // Adjust the column name as needed.  Also handle potential errors.

        const county = String(row.County || "").trim();
        const infected = parseInt(row.Flock_Size, 10);
        const state = String(row.State || "").trim();
        countyData.push({ county, infected, state });
      })
      .on("end", () => {
        resolve(countyData);
      })
      .on("error", (error: Error) => {
        reject(error);
      });
  });
}

function cleanString(input: string): string {
  // Remove all punctuation (keeping whitespace intact), convert to lowercase, and trim only the ends.
  return input
    .replace(/[^\w\s]|_/g, "") // Remove punctuation; \s preserves all whitespace in the middle
    .toLowerCase() // Convert to lowercase
    .trim(); // Trim leading and trailing whitespace
}

async function readCountiesFromCsv(filePath: string): Promise<CountiesCsv[]> {
  return new Promise((resolve, reject) => {
    const countyData: CountiesCsv[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: any) => {
        // Assuming your CSV has a column named 'InitialInfected' or similar.
        // Adjust the column name as needed.  Also handle potential errors.

        const FUNCSTAT = String(row.FUNCSTAT || "").trim();
        const CLASSFP = String(row.CLASSFP || "").trim();
        const COUNTYNAME = String(row.COUNTYNAME || "").trim();
        const COUNTYNS = String(row.COUNTYNS || "").trim();
        const COUNTYFP = String(row.COUNTYFP || "").trim();
        const STATEFP = String(row.STATEFP || "").trim();
        const STATE = String(row.STATE || "").trim();

        countyData.push({
          FUNCSTAT,
          CLASSFP,
          COUNTYNAME,
          COUNTYNS,
          COUNTYFP,
          STATEFP,
          STATE,
        });
      })
      .on("end", () => {
        resolve(countyData);
      })
      .on("error", (error: Error) => {
        reject(error);
      });
  });
}

function runSEIRModel(
  params: SEIRParameters,
  initialConditions: { S0: number; E0: number; I0: number; R0: number },
  timeSteps: number,
  timeStepSize: number,
): SEIRDataPoint[] {
  const { beta, sigma, gamma, population } = params;
  const { S0, E0, I0, R0 } = initialConditions;

  const results: SEIRDataPoint[] = [];
  let S = S0;
  let E = E0;
  let I = I0;
  let R = R0;

  results.push({ time: 0, S, E, I, R });

  for (let t = 1; t <= timeSteps; t++) {
    // Calculate the *changes* in each compartment using the SEIR equations.
    const dS = (-beta * I * S) / population;
    const dE = (beta * I * S) / population - sigma * E;
    const dI = sigma * E - gamma * I;
    const dR = gamma * I;

    // Update the compartments using Euler's method (simple and good for demonstration)
    S += dS * timeStepSize;
    E += dE * timeStepSize;
    I += dI * timeStepSize;
    R += dR * timeStepSize;

    // Add the current state to the results.
    results.push({ time: t * timeStepSize, S, E, I, R });
  }

  return results;
}

function mergeGeoJSONWithExternalData(
  countyData: CountyData,
  out_filename: string,
): void {
  // Create a lookup map from externalData keyed by the shared "code" property.
  const geojsonDataRaw = fs.readFileSync("georef_county.geojson", "utf8");
  let county_geojson;
  try {
    county_geojson = JSON.parse(geojsonDataRaw);
  } catch (error) {
    console.log("error parsing " + error);
  }
  for (let countyFeature of county_geojson.features) {
    const gnis = countyFeature.properties.coty_gnis_code;
    const simulatedData = countyData[gnis];
    countyFeature.properties = {
      ...countyFeature.properties,
      simulatedData,
    };
  }
  const jsonOutput = JSON.stringify(county_geojson, null, 2);
  fs.writeFileSync(path.join(__dirname, out_filename), jsonOutput);
}

class CompartmentModels {
  private beta: number;
  private sigma: number;
  private gamma: number;

  constructor(beta: number, sigma: number, gamma: number) {
    this.beta = beta;
    this.sigma = sigma;
    this.gamma = gamma;
  }

  public SEIR = async (): Promise<CountyData> => {
    const csvFilePath = path.join(__dirname, "commercial-backyard-flocks.csv"); // Path to your CSV
    const timeSteps = 100; // Number of time steps to simulate
    const timeStepSize = 1; // Size of each time step (e.g., 1 day)

    try {
      const countyData: CountyInfectionData[] =
        await readInitialInfectedFromCSV(csvFilePath);
      const allCountyData: CountyData = {};
      //Run Simulation for Each County
      for (let i = 0; i < countyData.length; i++) {
        const params: SEIRParameters = {
          beta: this.beta,
          sigma: this.sigma,
          gamma: this.gamma,
          population: countyData[i].infected,
        };

        const initialConditions = {
          S0: params.population - countyData[i].infected * 0.1,
          E0: 0, // Start with no exposed individuals (you could also read this from CSV)
          I0: countyData[i].infected * 0.1,
          R0: 0,
        };
        //Do Simulation for County
        const simulationResults = runSEIRModel(
          params,
          initialConditions,
          timeSteps,
          timeStepSize,
        );
        // Write results to a json file

        try {
          allCountyData[
            await getCountyCode(
              stateCodes.getStateCodeByStateName(countyData[i].state),
              countyData[i].county,
            )
          ] = simulationResults;
        } catch (error) {
          console.log(
            `Couldn't find a county code for ${countyData[i].county} in ${countyData[i].state}`,
          );
        }
      }
      //Turns the Simulation reasults in JSON
      return allCountyData;

      // Output the results (e.g., print to console, write to a new CSV, plot with a library)
    } catch (error) {
      // @ts-expect-error
      console.error("Error:", error.message);
      throw new Error("We broke something.");
    }
  };
}

// const jsonOutput = JSON.stringify(allCountyData, null, 2);
// fs.writeFileSync(path.join(__dirname, "seir_results.json"), jsonOutput);
// console.log("Results written to seir_results.csv");

const myModel = new CompartmentModels(0.2, 1 / 5, 1 / 10);
const out = await myModel.SEIR();
mergeGeoJSONWithExternalData(out, "out.geojson");
const jsonOutput = JSON.stringify(out, null, 2);
fs.writeFileSync(path.join(__dirname, "raw_data.json"), jsonOutput);
