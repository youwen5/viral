<script lang="ts">
  import { Input } from '$lib/components/ui/input/index.js';
  import {
    CompartmentalModels,
    mergeGeoJSONWithExternalData
  } from '$lib/data-analysis/compartmental-models';
  import { onMount } from 'svelte';
  import { Popup, GeoJSON, MapLibre, FillExtrusionLayer } from 'svelte-maplibre';
  import type { FeatureCollection } from 'geojson';
  import * as Card from '$lib/components/ui/card';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Slider } from '$lib/components/ui/slider';
  import { Button } from '$lib/components/ui/button';
  import { fly } from 'svelte/transition';
  import { ArrowDown, LoaderCircle } from 'lucide-svelte';
  import { PieChart } from 'layerchart';

  onMount(async () => {
    generateNewData();
  });

  // toggleable options
  let toggleableExtrusions = $state({
    human_simulation: false,
    infectedBirds: true,
    susceptibleBirds: false,
    resistantBirds: false,
    exposedBirds: false,
    infectedHumans: false,
    resistantHumans: false,
    exposedHumans: false,
    susceptibleHumans: false
  });

  let geojson = $state();
  let rawData = $state();

  // the amount of simulations our current loaded dataset has
  let max = $state(100);

  // the amount of simulations the user WANTS to run
  let desiredSimulationCount = $state(100);

  // this should be the county code the user selects "more info" in
  let selectedCounty = $state({ code: '', name: '', state: '' });

  const openPopupView = () => {
    dialogOpen = true;
  };

  let dialogOpen = $state(false);

  let generatingNewData = $state(false);

  let parameters = $state({
    avianSigma: 1 / 5,
    avianBeta: 0.2,
    avianGamma: 1 / 10,
    humanSigma: 1 / 5,
    humanBeta: 0.2,
    humanGamma: 1 / 10,
    humanSpreadCoefficient: 0.5
  });

  const generateNewData = async () => {
    generatingNewData = true;
    let seir = {};
    let humanseir = {};
    seir = await new CompartmentalModels(
      parameters.avianBeta,
      parameters.avianSigma,
      parameters.avianGamma
    ).SEIR(desiredSimulationCount);
    if (toggleableExtrusions.human_simulation) {
      humanseir = await new CompartmentalModels(
        parameters.humanBeta,
        parameters.humanSigma,
        parameters.humanGamma
      ).HumanSEIR(0.5, 1 / 3, 1 / 10, desiredSimulationCount, parameters.humanSpreadCoefficient);
    }
    max = desiredSimulationCount;
    geojson = await mergeGeoJSONWithExternalData(seir, humanseir);
    rawData = { human: humanseir, avian: seir };
    generatingNewData = false;
  };

  // right now this is the same as day, but subject to change
  let iter = $state(0);
  let animationPlaying = $state(false);
  // step size of the autoplayer
  let stepSize = $state(5);
  // the autoplay feature
  const increment_next = () => {
    if (iter >= max - 1) iter = 0;
    if (!animationPlaying) {
      animationPlaying = true;
      if (iter < max) {
        const interval = setInterval(() => {
          if (iter >= max - 1 || !animationPlaying) {
            clearInterval(interval);
            animationPlaying = false;
          }
          iter = Math.ceil(iter + stepSize / 5);
        }, 200);
      } else {
        animationPlaying = false;
      }
    } else {
      animationPlaying = false;
    }
  };
</script>

{#if geojson}
  <MapLibre
    style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    class="h-[100vh]"
    standardControls
    pitch={30}
    center={[-98.137, 40.137]}
    zoom={4}
  >
    <GeoJSON id="cbsa" data={geojson as unknown as FeatureCollection} promoteId="CBSAFP">
      {#if toggleableExtrusions.infectedBirds}
        <FillExtrusionLayer
          paint={{
            'fill-extrusion-base': 0,
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['/', ['get', 'I', ['at', iter, ['get', 'avian', ['get', 'simulatedData']]]], 10000],
              0,
              '#0a0',
              200,
              '#a00'
            ],
            'fill-extrusion-opacity': 0.6,
            'fill-extrusion-height': [
              '*',
              ['sqrt', ['get', 'I', ['at', iter, ['get', 'avian', ['get', 'simulatedData']]]]],
              1000
            ]
          }}
          beforeLayerType="symbol"
        >
          <Popup openOn="click" closeOnClickInside={true}>
            {#snippet children({ data })}
              {@const props = data?.properties}
              {#if props && props.simulatedData}
                {@const infection_data = JSON.parse(props.simulatedData)['avian'][iter]}
                <div class={`flex flex-col gap-2`}>
                  <div class="text-lg font-bold">
                    {props.coty_name.substring(2, props.coty_name.length - 2)}, {props.ste_name.substring(
                      2,
                      props.ste_name.length - 2
                    )}
                  </div>
                  <p>
                    Population: {Math.round(
                      infection_data.S + infection_data.I + infection_data.E + infection_data.R
                    )}
                  </p>
                  <p>Infected: {Math.round(infection_data.I)}</p>
                  <p>Susceptible: {Math.round(infection_data.S)}</p>
                  <p>Exposed: {Math.round(infection_data.E)}</p>
                  <p>Resistant: {Math.round(infection_data.R)}</p>
                  <Button
                    onclick={() => {
                      selectedCounty = {
                        code: props.coty_gnis_code,
                        state: props.ste_name.substring(2, props.ste_name.length - 2),
                        name: props.coty_name.substring(2, props.coty_name.length - 2)
                      };
                      openPopupView();
                    }}>Inspect</Button
                  >
                </div>
              {/if}
            {/snippet}
          </Popup>
        </FillExtrusionLayer>
      {/if}
      {#if toggleableExtrusions.exposedBirds}
        <FillExtrusionLayer
          paint={{
            'fill-extrusion-base': 0,
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              // Population density
              //['/', ['get', 'POPESTIMATE2020'], ['/', ['get', 'ALAND'], 1000000]],
              ['/', ['get', 'E', ['at', iter, ['get', 'avian', ['get', 'simulatedData']]]], 10000],
              0,
              '#0a0',
              200,
              '#a00'
            ],
            'fill-extrusion-opacity': 0.6,
            'fill-extrusion-height': [
              '*',
              ['sqrt', ['get', 'E', ['at', iter, ['get', 'avian', ['get', 'simulatedData']]]]],
              1000
            ]
          }}
          beforeLayerType="symbol"
        ></FillExtrusionLayer>
      {/if}
      {#if toggleableExtrusions.susceptibleBirds}
        <FillExtrusionLayer
          paint={{
            'fill-extrusion-base': 0,
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['/', ['get', 'S', ['at', iter, ['get', 'avian', ['get', 'simulatedData']]]], 10000],
              0,
              '#0a0',
              200,
              '#a00'
            ],
            'fill-extrusion-opacity': 0.6,
            'fill-extrusion-height': [
              '*',
              ['sqrt', ['get', 'S', ['at', iter, ['get', 'avian', ['get', 'simulatedData']]]]],
              1000
            ]
          }}
          beforeLayerType="symbol"
        ></FillExtrusionLayer>
      {/if}
      {#if toggleableExtrusions.resistantBirds}
        <FillExtrusionLayer
          paint={{
            'fill-extrusion-base': 0,
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['/', ['get', 'R', ['at', iter, ['get', 'avian', ['get', 'simulatedData']]]], 10000],
              0,
              '#0a0',
              200,
              '#a00'
            ],
            'fill-extrusion-opacity': 0.6,
            'fill-extrusion-height': [
              '*',
              ['sqrt', ['get', 'R', ['at', iter, ['get', 'avian', ['get', 'simulatedData']]]]],
              1000
            ]
          }}
          beforeLayerType="symbol"
        ></FillExtrusionLayer>
      {/if}
      {#if toggleableExtrusions.human_simulation}
        {#if toggleableExtrusions.infectedHumans}
          <FillExtrusionLayer
            paint={{
              'fill-extrusion-base': 0,
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                // Population density
                //['/', ['get', 'POPESTIMATE2020'], ['/', ['get', 'ALAND'], 1000000]],
                ['/', ['get', 'I', ['at', iter, ['get', 'human', ['get', 'simulatedData']]]], 5000],
                0,
                '#0a0',
                200,
                '#a00'
              ],
              'fill-extrusion-opacity': 0.6,
              'fill-extrusion-height': [
                '*',
                ['sqrt', ['get', 'I', ['at', iter, ['get', 'human', ['get', 'simulatedData']]]]],
                1000
              ]
            }}
            beforeLayerType="symbol"
          >
            <Popup openOn="click" closeOnClickInside={true}>
              {#snippet children({ data })}
                {@const props = data?.properties}
                {#if props && props.simulatedData}
                  {@const infection_data = JSON.parse(props.simulatedData)['human'][iter]}
                  <div class={`flex flex-col gap-2`}>
                    <div class="text-lg font-bold">
                      {props.coty_name.substring(2, props.coty_name.length - 2)}, {props.ste_name.substring(
                        2,
                        props.ste_name.length - 2
                      )}
                    </div>
                    <p>
                      Population: {Math.round(
                        infection_data.S + infection_data.I + infection_data.E + infection_data.R
                      )}
                    </p>
                    <p>Infected: {Math.round(infection_data.I)}</p>
                    <p>Susceptible: {Math.round(infection_data.S)}</p>
                    <p>Exposed: {Math.round(infection_data.E)}</p>
                    <p>Resistant: {Math.round(infection_data.R)}</p>
                    <Button
                      onclick={() => {
                        selectedCounty = {
                          code: props.coty_gnis_code,
                          state: props.ste_name.substring(2, props.ste_name.length - 2),
                          name: props.coty_name.substring(2, props.coty_name.length - 2)
                        };
                        openPopupView();
                      }}>Inspect</Button
                    >
                  </div>
                {/if}
              {/snippet}
            </Popup>
          </FillExtrusionLayer>
        {/if}
        {#if toggleableExtrusions.exposedHumans}
          <FillExtrusionLayer
            paint={{
              'fill-extrusion-base': 0,
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                // Population density
                //['/', ['get', 'POPESTIMATE2020'], ['/', ['get', 'ALAND'], 1000000]],
                ['/', ['get', 'E', ['at', iter, ['get', 'human', ['get', 'simulatedData']]]], 5000],
                0,
                '#0a0',
                200,
                '#a00'
              ],
              'fill-extrusion-opacity': 0.6,
              'fill-extrusion-height': [
                '*',
                ['sqrt', ['get', 'E', ['at', iter, ['get', 'human', ['get', 'simulatedData']]]]],
                1000
              ]
            }}
            beforeLayerType="symbol"
          ></FillExtrusionLayer>
        {/if}
        {#if toggleableExtrusions.susceptibleHumans}
          <FillExtrusionLayer
            paint={{
              'fill-extrusion-base': 0,
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['/', ['get', 'S', ['at', iter, ['get', 'human', ['get', 'simulatedData']]]], 5000],
                0,
                '#0a0',
                200,
                '#a00'
              ],
              'fill-extrusion-opacity': 0.6,
              'fill-extrusion-height': [
                '*',
                ['sqrt', ['get', 'S', ['at', iter, ['get', 'human', ['get', 'simulatedData']]]]],
                1000
              ]
            }}
            beforeLayerType="symbol"
          ></FillExtrusionLayer>
        {/if}
        {#if toggleableExtrusions.resistantHumans}
          <FillExtrusionLayer
            paint={{
              'fill-extrusion-base': 0,
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['/', ['get', 'R', ['at', iter, ['get', 'human', ['get', 'simulatedData']]]], 5000],
                0,
                '#0a0',
                200,
                '#a00'
              ],
              'fill-extrusion-opacity': 0.6,
              'fill-extrusion-height': [
                '*',
                ['sqrt', ['get', 'R', ['at', iter, ['get', 'human', ['get', 'simulatedData']]]]],
                1000
              ]
            }}
            beforeLayerType="symbol"
          ></FillExtrusionLayer>
        {/if}
      {/if}
    </GeoJSON>
  </MapLibre>
{:else}
  <p>Loading</p>
{/if}

{#if dialogOpen}
  <!--
  {@const avianData = rawData.avian[selectedCounty.code][iter]}
  {@const humanData = rawData.human[selectedCounty.code][iter]}
  -->
  {@const avianChartData = [
    { title: 'Susceptible', amount: rawData.avian[selectedCounty.code][iter].S, color: '#a35c00' },
    { title: 'Infectious', amount: rawData.avian[selectedCounty.code][iter].I, color: '#a30026' },
    { title: 'Exposed', amount: rawData.avian[selectedCounty.code][iter].E, color: '#5400a3' },
    { title: 'Recovered', amount: rawData.avian[selectedCounty.code][iter].R, color: '#50b53c' }
  ]}

  <div
    class="fixed bottom-12 left-12 top-12 w-[600px] flex-grow gap-2 overflow-y-auto rounded-lg bg-background bg-opacity-60 p-4 shadow-lg backdrop-blur-lg md:w-[800px]"
    transition:fly={{ y: 200 }}
  >
    <Button
      class="fixed right-2 top-2"
      size="icon"
      variant="outline"
      onclick={() => (dialogOpen = false)}><ArrowDown /></Button
    >
    <p class="my-2 text-xl">
      Viewing <span class="font-medium">{selectedCounty.name}, {selectedCounty.state}</span>.
    </p>
    <div class="mt-4 flex">
      <Card.Root>
        <Card.Header
          ><Card.Title>Infectious, susceptible, exposed, recovered (avian)</Card.Title></Card.Header
        >
        <Card.Content class="h-[400px] w-[400px] ">
          <PieChart
            key="title"
            value="amount"
            series={avianChartData.map((d) => {
              return {
                key: d.title,
                data: [d],
                maxValue:
                  rawData.avian[selectedCounty.code][iter].I +
                  rawData.avian[selectedCounty.code][iter].E +
                  rawData.avian[selectedCounty.code][iter].R +
                  rawData.avian[selectedCounty.code][iter].S,
                color: d.color
              };
            })}
            outerRadius={-35}
            innerRadius={-25}
            cornerRadius={10}
          />
          <!--
          {#if rawData.human}
            {@const humanChartData = [
              {
                title: 'Susceptible',
                amount: rawData.human[selectedCounty.code][iter].S,
                color: '#a35c00'
              },
              {
                title: 'Infectious',
                amount: rawData.human[selectedCounty.code][iter].I,
                color: '#a30026'
              },
              {
                title: 'Exposed',
                amount: rawData.human[selectedCounty.code][iter].E,
                color: '#5400a3'
              },
              {
                title: 'Recovered',
                amount: rawData.human[selectedCounty.code][iter].R,
                color: '#50b53c'
              }
            ]}
            <PieChart
              key="title"
              value="amount"
              series={humanChartData.map((d) => {
                return {
                  key: d.title,
                  data: [d],
                  maxValue:
                    rawData.human[selectedCounty.code][iter].I +
                    rawData.human[selectedCounty.code][iter].E +
                    rawData.human[selectedCounty.code][iter].R +
                    rawData.human[selectedCounty.code][iter].S,
                  color: d.color
                };
              })}
              outerRadius={-35}
              innerRadius={-25}
              cornerRadius={10}
            />
          {/if}
          -->
        </Card.Content>
      </Card.Root>
    </div>
  </div>
{/if}

<div
  class="fixed bottom-2 right-2 top-2 w-96 overflow-y-auto rounded-lg bg-background bg-opacity-60 p-4 shadow-lg backdrop-blur-lg"
>
  <h1 class="text-3xl font-bold">Virion</h1>
  <p class="mt-4">
    An epidemic modeler to track and predict the <a
      href="https://www.cdc.gov/bird-flu/situation-summary/index.html"
      class="link">H5N1 Avian Influenza</a
    > outbreak using compartmental models and generative agents.
  </p>
  <p class="mt-4">
    For our primary projections, we use the SEIR <a
      class="link"
      href="https://en.wikipedia.org/wiki/Compartmental_models_in_epidemiology"
      >compartmental model</a
    >, a suitable mathematical model of infectious disease spread which groups populations into
    compartments of "susceptible," "exposed," "infected," or "recovered."
  </p>
  <p class="mt-4">
    We also conduct simulations at the local level using a novel agent-based technique as described
    in the paper <em>Epidemic Modeling with Generative Agents</em> (<a
      class="link"
      href="https://arxiv.org/abs/2307.04986">arXiv:2307.04986</a
    >).
  </p>
  <p class="mt-4">
    Free and open source available on <a class="link" href="https://github.com/youwen5/viral"
      >GitHub</a
    > under the BSD license.
  </p>
  <div class="mt-4 space-y-2">
    <Card.Root>
      <Card.Header>
        <Card.Title>Simulation controls</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="space-y-2">
          <p class="font-medium">Days passed: {iter}</p>
          <Slider type="single" bind:value={iter} {max} step={1} class="ml-2 max-w-[70%]" />
        </div>
        <Button onclick={increment_next} variant={!animationPlaying ? 'default' : 'secondary'}
          >{iter >= max - 1 ? 'Replay' : !animationPlaying ? 'Play' : 'Pause'}</Button
        >
        {#if !generatingNewData}
          <Button onclick={generateNewData} variant="outline">Generate</Button>
        {:else}
          <Button disabled>
            <LoaderCircle class="animate-spin" />
            Please wait
          </Button>
        {/if}
        <div class="flex items-center gap-2">
          <p>
            Simulation speed (days per second):
            <Input type="number" bind:value={stepSize} placeholder="1" class="mt-2 max-w-[4rem]" />
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div>
            Days to simulate:
            <Input
              type="number"
              bind:value={desiredSimulationCount}
              placeholder="100"
              class="mt-2 max-w-[5rem]"
            />
            <p class={`my-2 text-red-500 ${desiredSimulationCount <= 200 ? 'hidden' : ''}`}>
              WARNING: setting a simulation count too large may lead to a critical program crash.
            </p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" bind:checked={toggleableExtrusions.human_simulation} />
          <Label for="terms">Model human transmission</Label>
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Header>
        <Card.Title>View filters</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-2">
        <div class="flex items-center space-x-2">
          <Checkbox id="infectedbirds" bind:checked={toggleableExtrusions.infectedBirds} />
          <Label for="infectedavians">Show infected birds</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="resistantavians" bind:checked={toggleableExtrusions.resistantBirds} />
          <Label for="resistantavians">Show resistant birds</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="susceptiblebird" bind:checked={toggleableExtrusions.susceptibleBirds} />
          <Label for="susceptiblebird">Show susceptible avians</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="exposedbird" bind:checked={toggleableExtrusions.exposedBirds} />
          <Label for="exposedbird">Show exposed avians</Label>
        </div>
        {#if toggleableExtrusions.human_simulation}
          <div class="flex items-center space-x-2">
            <Checkbox id="infectedhuman" bind:checked={toggleableExtrusions.infectedHumans} />
            <Label for="infectedhuman">Show infected humans</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox id="resistanthuman" bind:checked={toggleableExtrusions.resistantHumans} />
            <Label for="resistanthuman">Show resistant humans</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox id="susceptiblehuman" bind:checked={toggleableExtrusions.susceptibleHumans} />
            <Label for="susceptiblehuman">Show susceptible humans</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox id="exposedbird" bind:checked={toggleableExtrusions.exposedHumans} />
            <Label for="exposedbird">Show exposed humans</Label>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Header>
        <Card.Title>Compartmental parameters</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-2">
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Beta (avian): {parameters.avianBeta}</p>
          <Slider
            bind:value={parameters.avianBeta}
            type="single"
            max={1}
            step={0.05}
            class="max-w-[70%]"
          />
        </div>
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Sigma (avian): {parameters.avianSigma}</p>
          <Slider
            bind:value={parameters.avianSigma}
            type="single"
            max={1}
            step={0.05}
            class="max-w-[70%]"
          />
        </div>
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Gamma (avian): {parameters.avianGamma}</p>
          <Slider
            bind:value={parameters.avianGamma}
            type="single"
            max={1}
            step={0.05}
            class="max-w-[70%]"
          />
        </div>
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Beta (human): {parameters.humanBeta}</p>
          <Slider
            bind:value={parameters.humanBeta}
            type="single"
            max={1}
            step={0.05}
            class="max-w-[70%]"
          />
        </div>
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Sigma (human): {parameters.humanSigma}</p>
          <Slider
            bind:value={parameters.humanSigma}
            type="single"
            max={1}
            step={0.05}
            class="max-w-[70%]"
          />
        </div>
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Gamma (human): {parameters.humanGamma}</p>
          <Slider
            bind:value={parameters.humanGamma}
            type="single"
            max={1}
            step={0.05}
            class="max-w-[70%]"
          />
        </div>
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">
            Human infection coefficient: {parameters.humanSpreadCoefficient}
          </p>
          <Slider
            bind:value={parameters.humanSpreadCoefficient}
            type="single"
            max={1}
            step={0.01}
            class="max-w-[70%]"
          />
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>

<style lang="postcss">
  .link {
    @apply underline decoration-violet-400 decoration-2;
  }
</style>
