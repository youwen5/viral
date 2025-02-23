<script lang="ts">
  import { Input } from '$lib/components/ui/input/index.js';
  import generatedData from '$lib/data/out_geo.json';
  import rawData from '$lib/data/raw_data.json';
  import { CompartmentalModels, mergeGeoJSONWithExternalData } from '$lib/data-analysis/index.ts';
  import {onMount} from 'svelte'
  import { Popup, GeoJSON, MapLibre, FillExtrusionLayer } from 'svelte-maplibre';
  import type { FeatureCollection } from 'geojson';
  import * as Card from '$lib/components/ui/card';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Slider } from '$lib/components/ui/slider';
  import { Button } from '$lib/components/ui/button';
  import { fly } from 'svelte/transition';
  import { ArrowDown } from 'lucide-svelte';
  import { PieChart, Text } from 'layerchart';

  onMount(async () => {
    const model = new CompartmentalModels(0.2, 1 / 5, 1 / 10);
    //console.log(await model.SEIR())
    geojson = await mergeGeoJSONWithExternalData(await model.SEIR())
  })

  // toggleable options
  let toggleableExtrusions = $state({
    infectedBirds: true,
    susceptibleBirds: false,
    resistantBirds: false,
    exposedBirds: false,
    infectedHumans: true,
    resistantHumans: false,
    exposedHumans: false,
    susceptibleHumans: false
  });

  let geojson = $state()

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
            // Population density
            //['/', ['get', 'POPESTIMATE2020'], ['/', ['get', 'ALAND'], 1000000]],
            ['/', ['get', 'S', ['at', iter, ['get', 'simulatedData']]], 10000],
            0,
            '#0a0',
            200,
            '#a00'
          ],
          'fill-extrusion-opacity': 0.6,
          'fill-extrusion-height': [
            '*',
            ['sqrt', ['get', 'I', ['at', iter, ['get', 'simulatedData']]]],
            1000
          ]
        }}
        beforeLayerType="symbol"
      >
        <Popup openOn="click" closeOnClickInside={true}>
          {#snippet children({ data })}
            {@const props = data?.properties}
            {#if props && props.simulatedData}
              {@const infection_data = JSON.parse(props.simulatedData)[iter]}
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
            ['/', ['get', 'E', ['at', iter, ['get', 'simulatedData']]], 10000],
            0,
            '#0a0',
            200,
            '#a00'
          ],
          'fill-extrusion-opacity': 0.6,
          'fill-extrusion-height': [
            '*',
            ['sqrt', ['get', 'E', ['at', iter, ['get', 'simulatedData']]]],
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
            ['/', ['get', 'S', ['at', iter, ['get', 'simulatedData']]], 10000],
            0,
            '#0a0',
            200,
            '#a00'
          ],
          'fill-extrusion-opacity': 0.6,
          'fill-extrusion-height': [
            '*',
            ['sqrt', ['get', 'S', ['at', iter, ['get', 'simulatedData']]]],
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
            ['/', ['get', 'R', ['at', iter, ['get', 'simulatedData']]], 10000],
            0,
            '#0a0',
            200,
            '#a00'
          ],
          'fill-extrusion-opacity': 0.6,
          'fill-extrusion-height': [
            '*',
            ['sqrt', ['get', 'R', ['at', iter, ['get', 'simulatedData']]]],
            1000
          ]
        }}
        beforeLayerType="symbol"
      ></FillExtrusionLayer>
    {/if}
  </GeoJSON>
</MapLibre>
{/if}

{#if dialogOpen}
  {@const data = rawData[selectedCounty.code][iter]}
  {@const chartData = [
    { title: 'Susceptible', amount: data.S, color: '#a35c00' },
    { title: 'Infectious', amount: data.I, color: '#a30026' },
    { title: 'Exposed', amount: data.E, color: '#5400a3' },
    { title: 'Recovered', amount: data.R, color: '#50b53c' }
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
          ><Card.Title>Infectious, susceptible, exposed, recovered</Card.Title></Card.Header
        >
        <Card.Content class="h-[400px] w-[400px] ">
          <PieChart
            key="title"
            value="amount"
            series={chartData.map((d) => {
              return {
                key: d.title,
                data: [d],
                maxValue: data.I + data.E + data.R + data.S,
                color: d.color
              };
            })}
            outerRadius={-35}
            innerRadius={-25}
            cornerRadius={10}
          />
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
          <Slider type="single" bind:value={iter} max={100} step={1} class="ml-2 max-w-[70%]" />
        </div>
        <Button onclick={increment_next} variant={!animationPlaying ? 'default' : 'secondary'}
          >{iter >= max - 1 ? 'Replay' : !animationPlaying ? 'Play' : 'Pause'}</Button
        >
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
            <p class={`my-2 text-red-500 ${desiredSimulationCount <= 1000 ? 'hidden' : ''}`}>
              WARNING: setting a simulation count too large may lead to a critical program crash.
            </p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" />
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
          <Label for="infectedbirds">Show infected birds</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="resistantbirds" bind:checked={toggleableExtrusions.resistantBirds} />
          <Label for="resistantbirds">Show resistant birds</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="susceptiblebird" bind:checked={toggleableExtrusions.susceptibleBirds} />
          <Label for="susceptiblebird">Show susceptible birds</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="exposedbird" bind:checked={toggleableExtrusions.exposedBirds} />
          <Label for="exposedbird">Show exposed birds</Label>
        </div>
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
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Header>
        <Card.Title>Compartmental parameters</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-2">
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Transmission rate</p>
          <Slider type="single" max={100} step={1} class="max-w-[70%]" />
        </div>
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Various rates</p>
          <Slider type="single" max={100} step={1} class="max-w-[70%]" />
        </div>
        <div class="space-y-2 rounded-sm border border-muted p-4">
          <p class="font-medium">Some parameter</p>
          <Slider type="single" max={100} step={1} class="max-w-[70%]" />
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
