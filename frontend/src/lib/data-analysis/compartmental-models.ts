import stateCodes from 'us-state-codes';
import { parse } from 'csv-parse/browser/esm/sync';

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

const getCountyCode = (state: string, userCounty: string, countyCsvData: CountiesCsv[]) => {
  const counties = countyCsvData;
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
  console.log('Could not find county');
  throw new Error('county not found');
};

export async function readInitialInfectedFromCSV(): Promise<CountyInfectionData[]> {
  // Fetch the CSV from /cdcdata.csv
  const response = await fetch('/cdcdata.csv');
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
  }

  // Read the CSV text
  const csvText = await response.text();

  try {
    // Parse the CSV string into objects keyed by header (columns: true)
    const records = parse(csvText, {
      columns: true, // Treat first row as headers
      skip_empty_lines: true,
      trim: true // Trim each cell's content
    }) as any[];

    // Transform the records into your desired data shape
    const countyData: CountyInfectionData[] = records.map((row) => {
      // Adjust column names to match your CSV headers
      const county = String(row.County || '').trim();
      const state = String(row.State || '').trim();
      const infected = parseInt(row.Flock_Size, 10) || 0;

      return { county, state, infected };
    });

    return countyData;
  } catch (parseError) {
    throw new Error(`Error parsing CSV: ${parseError}`);
  }
}

function cleanString(input: string): string {
  // Remove all punctuation (keeping whitespace intact), convert to lowercase, and trim only the ends.
  return input
    .replace(/[^\w\s]|_/g, '') // Remove punctuation; \s preserves all whitespace in the middle
    .toLowerCase() // Convert to lowercase
    .trim(); // Trim leading and trailing whitespace
}

export async function readCountiesFromCsv(): Promise<CountiesCsv[]> {
  // Fetch the CSV from "/counties.csv"
  const response = await fetch('/counties.csv');
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV file: ${response.status} ${response.statusText}`);
  }

  // Read the CSV file contents as text
  const csvText = await response.text();

  try {
    // Parse the CSV into an array of objects
    // columns: true => Use the first row as header keys
    // skip_empty_lines: true => ignore any empty lines
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true // optionally trim each field
    }) as any[];

    // Convert raw CSV rows to our CountiesCsv structure
    const countyData: CountiesCsv[] = records.map((row) => {
      return {
        FUNCSTAT: String(row.FUNCSTAT || '').trim(),
        CLASSFP: String(row.CLASSFP || '').trim(),
        COUNTYNAME: String(row.COUNTYNAME || '').trim(),
        COUNTYNS: String(row.COUNTYNS || '').trim(),
        COUNTYFP: String(row.COUNTYFP || '').trim(),
        STATEFP: String(row.STATEFP || '').trim(),
        STATE: String(row.STATE || '').trim()
      };
    });

    return countyData;
  } catch (err) {
    throw new Error(`Error parsing CSV: ${err}`);
  }
}

function runSEIRModel(
  params: SEIRParameters,
  initialConditions: { S0: number; E0: number; I0: number; R0: number },
  timeSteps: number,
  timeStepSize: number,
  humanSpreadCoefficient: number = 0.1
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

    if (I <= 0 && Math.random() < humanSpreadCoefficient) {
      const infected = population * 0.01;
      if (infected < 1) {
        I += 1;
      } else if (infected > 1000) {
        I += 1000;
      } else {
        I += infected;
      }
    }

    // Add the current state to the results.
    results.push({ time: t * timeStepSize, S, E, I, R });
  }

  return results;
}

export async function mergeGeoJSONWithExternalData(
  avianData: CountyData,
  humanData: CountyData
): Promise<any> {
  try {
    // Fetch the GeoJSON data from the specified URL.
    const response = await fetch('/counties_raw.geojson');
    if (!response.ok) {
      throw new Error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
    }
    const countyGeoJSON = await response.json();

    // Merge external county data into each feature's properties.
    countyGeoJSON.features.forEach((countyFeature: any) => {
      const gnis = countyFeature.properties.coty_gnis_code;
      const avianSimulatedData = avianData[gnis];
      const humanSimultedData = humanData[gnis];
      countyFeature.properties = {
        ...countyFeature.properties,
        simulatedData: {
          human: humanSimultedData,
          avian: avianSimulatedData
        }
      };
    });

    // Return the merged GeoJSON object.
    return countyGeoJSON;
  } catch (error) {
    console.error('Error fetching or processing GeoJSON:', error);
    throw error;
  }
}

export class CompartmentalModels {
  private beta: number;
  private sigma: number;
  private gamma: number;

  constructor(beta: number, sigma: number, gamma: number) {
    this.beta = beta;
    this.sigma = sigma;
    this.gamma = gamma;
  }

  public SEIR = async (iterations: number): Promise<CountyData> => {
    const timeStepSize = 1; // Size of each time step (e.g., 1 day)

    try {
      const countyData: CountyInfectionData[] = await readInitialInfectedFromCSV();
      const countyCodes: CountiesCsv[] = await readCountiesFromCsv();
      const allCountyData: CountyData = {};
      //Run Simulation for Each County
      for (let i = 0; i < countyData.length; i++) {
        const params: SEIRParameters = {
          beta: this.beta,
          sigma: this.sigma,
          gamma: this.gamma,
          population: countyData[i].infected
        };

        const initialConditions = {
          S0: params.population - countyData[i].infected * 0.1,
          E0: 0, // Start with no exposed individuals (you could also read this from CSV)
          I0: countyData[i].infected * 0.1,
          R0: 0
        };
        //Do Simulation for County
        const simulationResults = runSEIRModel(params, initialConditions, iterations, timeStepSize);
        // Write results to a json file

        try {
          allCountyData[
            getCountyCode(
              stateCodes.getStateCodeByStateName(countyData[i].state),
              countyData[i].county,
              countyCodes
            )
          ] = simulationResults;
        } catch (error) {
          console.log(
            `Couldn't find a county code for ${countyData[i].county} in ${countyData[i].state}`
          );
        }
      }

      return allCountyData;
    } catch (error) {
      // @ts-expect-error
      console.error('Error:', error.message);
      throw new Error('We broke something.');
    }
  };

  public HumanSEIR = async (
    t_beta: number,
    t_sigma: number,
    t_gamma: number,
    timeSteps: number,
    humanSpreadCoefficient: number
  ): Promise<CountyData> => {
    const timeStepSize = 1; // Size of each time step (e.g., 1 day)

    try {
      const geojsonDataRaw = await fetch('/counties_raw.geojson');
      let county_geojson;
      try {
        county_geojson = await geojsonDataRaw.json();
      } catch (error) {
        console.log('error parsing ' + error);
      }
      const allCountyData: CountyData = {};

      const response = await fetch('/county_pop.csv');
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV file: ${response.status} ${response.statusText}`);
      }
      const csvText = await response.text();
      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as any[];

      //Run Simulation for Each County
      for (const countyFeature of county_geojson.features) {
        const county_name =
          countyFeature.properties.coty_name_long + ', ' + countyFeature.properties.ste_name;
        const row = records.find((r) => String(r['Geographic Area']).trim() === county_name);

        const params: SEIRParameters = {
          beta: t_beta,
          sigma: t_sigma,
          gamma: t_gamma,
          population: row != undefined ? parseInt(row['2023'].replace(/,/g, ''), 10) : 100000
        };

        const initialConditions = {
          S0: params.population,
          E0: 0, // Start with no exposed individuals (you could also read this from CSV)
          I0: 0,
          R0: 0
        };
        //Do Simulation for County
        const simulationResults = runSEIRModel(
          params,
          initialConditions,
          timeSteps,
          timeStepSize,
          humanSpreadCoefficient
        );
        // Write results to a json file
        const gnis = countyFeature.properties.coty_gnis_code;
        try {
          allCountyData[gnis] = simulationResults;
        } catch (error) {
          console.log(`Couldn't find a county code for ${gnis} code for county`);
        }
      }
      //Turns the Simulation reasults in JSON
      return allCountyData;

      // Output the results (e.g., print to console, write to a new CSV, plot with a library)
    } catch (error) {
      // @ts-expect-error
      console.error('Error:', error.message);
      throw new Error('We broke something.');
    }
  };
}
