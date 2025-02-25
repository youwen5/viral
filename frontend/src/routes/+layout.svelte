<script lang="ts">
  import '../app.css';
  import { Toaster } from '$lib/components/ui/sonner';
  let { children } = $props();
</script>

<svelte:head>
	<title>Virion</title>
	<meta name="description" content="An interactive epidemic modeler and visualizer in 3D for the H5N1 avian influenza." />
</svelte:head>

<Toaster />

{@render children()}
