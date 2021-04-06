<script lang="ts">
  import type { User } from "./interfaces";
  export let user: User | undefined;
</script>

<div class="card">
  <img alt="user pic" src={user ? user.img_src : ""} />
  <p class="has-text-centered">{user ? user.username : ""}</p>
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

  img {
    height: 100px;
    object-fit: contain;
  }
</style>
