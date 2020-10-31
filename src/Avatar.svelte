<script lang="ts">
  import { users } from "./stores";
  export let username: string;
  let img_src: string = $users.get(username).img_src;
</script>

<style>
  div {
    width: 100px;
    border: 1px solid #aaa;
    border-radius: 5px;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.1);
    padding: 0.5em;
    margin: 0 0 1em 1em;
    font-weight: normal;
    font-size: 1em;
    float: left;
  }
</style>

<div>
  <img class="is-96x96" alt="user pic" src={img_src} />
  <p class="has-text-centered">{username}</p>
</div>
