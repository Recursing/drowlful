<script lang="ts">
  import User from "./User.svelte";
  import Server from "./Server.svelte";
</script>

{#if location.hash}
  <User />
{:else}
  <Server />
{/if}
