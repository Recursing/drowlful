<script lang="ts">
  import type { User } from "./interfaces";
  export let user: User | undefined;
</script>

<div class="">
  <img alt="user pic" src={user ? user.img_src : ""} />
  <p class="has-text-centered">{user ? user.username : ""}</p>
</div>

<style>
  div {
    width: 120px;
    box-shadow: 0;
    padding: 0em;
    margin: 0;
    float: left;
  }
  p {
    margin: 0.5em 0 0 0;
    overflow-wrap: break-word;
  }

  img {
    height: 60px;
    margin: auto;
    object-fit: contain;
  }
</style>
