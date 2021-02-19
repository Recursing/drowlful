<script lang="ts">
  import { users } from "./stores";
  export let username: string;
  $: img_src = $users.get(username)?.img_src;
</script>

<div class="card">
  <img alt="user pic" src={img_src} />
  <p class="has-text-centered">{username}</p>
</div>

<style>
  div {
    width: 120px;
    border: 1px solid #aaa;
    border-radius: 5px;
    padding: 0.5em;
    margin: 0.5em;
    float: left;
  }
  p {
    margin: 0.5em 0 0 0;
    overflow-wrap: break-word;
  }
</style>
