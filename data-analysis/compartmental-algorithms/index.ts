import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

interface SEIRDataPoint {
    time: number;
    S: number;
    E: number;
    I: number;
    R: number;
}

interface SEIRParameters {
    beta: number;         // Transmission rate
    sigma: number;        // Rate of progression from exposed to infectious (1/incubation period)
    gamma: number;        // Recovery rate (1/infectious period)
    population: number;    // Total population
}

interface CountyInfectionData {
    county : string;
    infected : number;
}

interface CountyData {
    [countyName: string]: SEIRDataPoint[];
}

async function readInitialInfectedFromCSV(filePath: string): Promise<CountyInfectionData[]> {
    return new Promise((resolve, reject) => {
        const countyData: CountyInfectionData[] = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row: any) => {
                // Assuming your CSV has a column named 'InitialInfected' or similar.
                // Adjust the column name as needed.  Also handle potential errors.

                if (String(row.State) == "California") {
                    const county = String(row.County || '').trim();
                    const infected = parseInt(row.Flock_Size, 10);
                    countyData.push({ county: county, infected: infected });
                }
            })
            .on('end', () => {
                resolve(countyData);
            })
            .on('error', (error: Error) => {
                reject(error);
            });
    });
}

function runSEIRModel(
    params: SEIRParameters,
    initialConditions: { S0: number; E0: number; I0: number; R0: number },
    timeSteps: number,
    timeStepSize: number
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
        const dS = (-beta * S * I) / population;
        const dE = (beta * S * I) / population - sigma * E;
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

class CompartmentModels {
    private beta: number;
    private sigma: number;
    private gamma: number;
    private population: number;

    constructor(beta: number, sigma: number, gamma: number, pop: number) {
        this.beta = beta;
        this.sigma = sigma;
        this.gamma = gamma;
        this.population = pop;
    }

    public SEIR = async () => {
        const csvFilePath = path.join(__dirname, 'commercial-backyard-flocks.csv'); // Path to your CSV
        const params: SEIRParameters = {
            beta: this.beta,
            sigma: this.sigma,
            gamma: this.gamma,
            population: this.population,
        }
        const timeSteps = 100;          // Number of time steps to simulate
        const timeStepSize = 1;        // Size of each time step (e.g., 1 day)


        try {
            const countyData: CountyInfectionData[] = await readInitialInfectedFromCSV(csvFilePath);
            const allCountyData: CountyData = {};
            //Run Simulation for Each County
            for(let i = 0; i < countyData.length; i++)
            {
                const initialConditions = {
                    S0: params.population - countyData[i].infected,
                    E0: 0,         // Start with no exposed individuals (you could also read this from CSV)
                    I0: countyData[i].infected,
                    R0: 0,
                };
                //Do Simulation for County
                const simulationResults = runSEIRModel(params, initialConditions, timeSteps, timeStepSize);
                // Write results to a json file
                allCountyData[countyData[i].county] = simulationResults;
            }
            //Turns the Simulation reasults in JSON
            const jsonOutput = JSON.stringify(allCountyData, null, 2);
            fs.writeFileSync(path.join(__dirname, 'seir_results.json'), jsonOutput);
            console.log("Results written to seir_results.csv");

            // Output the results (e.g., print to console, write to a new CSV, plot with a library)
        } catch (error) {
            // @ts-expect-error
            console.error("Error:", error.message);
        }
        
    }
}

const myModel = new CompartmentModels(0.2, 1/5, 1/10, 1000000)
myModel.SEIR()