<script lang="ts">
  import cbsa from '$lib/data/cbsa.json';
  import { Popup, GeoJSON, MapLibre, FillExtrusionLayer } from 'svelte-maplibre';
  import type { FeatureCollection } from 'geojson';
  import * as Card from '$lib/components/ui/card';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import { Slider } from '$lib/components/ui/slider';
</script>

<MapLibre
  style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
  class="h-[100vh]"
  standardControls
  pitch={30}
  center={[-98.137, 40.137]}
  zoom={4}
>
  <GeoJSON id="cbsa" data={cbsa as unknown as FeatureCollection} promoteId="CBSAFP">
    <FillExtrusionLayer
      paint={{
        'fill-extrusion-base': 0,
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          // Population density
          ['/', ['get', 'POPESTIMATE2020'], ['/', ['get', 'ALAND'], 1000000]],
          0,
          '#0a0',
          200,
          '#a00'
        ],
        'fill-extrusion-opacity': 0.6,
        'fill-extrusion-height': ['/', ['get', 'POPESTIMATE2020'], 20]
      }}
      beforeLayerType="symbol"
    >
      <Popup openOn="hover">
        {#snippet children({ data })}
          {@const props = data?.properties}
          {#if props}
            <div class="flex flex-col gap-2">
              <div class="text-lg font-bold">{props.NAME}</div>
              <p>Population: {props.POPESTIMATE2020}</p>
            </div>
          {/if}
        {/snippet}
      </Popup>
    </FillExtrusionLayer>
  </GeoJSON>
</MapLibre>

<div
  class="fixed bottom-2 right-2 top-2 w-96 overflow-y-auto rounded-lg bg-background bg-opacity-60 p-4 shadow-lg backdrop-blur-lg"
>
  <h1 class="text-3xl font-bold">Viral</h1>
  <p class="mt-4">
    A compartmental epidemic modeler to track and predict the H5N1 Avian Flu outbreak using SEIR
    models.
  </p>
  <p class='mt-4'>
    Supports SEIR, SIR, and various other compartmental models. Source available on <a class='link' href="https://github.com/youwen5/viral">GitHub</a>.
  </p>
  <div class="mt-4 space-y-2">
    <Card.Root>
      <Card.Header>
        <Card.Title>Simulation options</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-2">
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label for="terms">Model human transmission</Label>
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Header>
        <Card.Title>View options</Card.Title>
      </Card.Header>
      <Card.Content class="space-y-2">
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label for="terms">Show infected birds</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label for="terms">Show resistant birds</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label for="terms">Show susceptible birds</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label for="terms">Show infected humans</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label for="terms">Show resistant humans</Label>
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label for="terms">Show susceptible humans</Label>
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
