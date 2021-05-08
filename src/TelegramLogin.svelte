<script lang="ts">
  import { onMount } from "svelte";
  import { socket } from "./Websocket";
  import { state, my_username } from "./stores";

  let username = "";
  let prompt = "";

  interface TelegramUser {
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    id?: string;
  }

  const default_images = [
    "https://upload.wikimedia.org/wikipedia/en/a/a6/Pok%C3%A9mon_Pikachu_art.png",
    "https://upload.wikimedia.org/wikipedia/en/2/28/Pok%C3%A9mon_Bulbasaur_art.png",
    "https://upload.wikimedia.org/wikipedia/en/5/59/Pok%C3%A9mon_Squirtle_art.png",
    "https://upload.wikimedia.org/wikipedia/en/a/a5/Pok%C3%A9mon_Charmander_art.png",
    "https://upload.wikimedia.org/wikipedia/en/2/22/Pok%C3%A9mon_Jigglypuff_art.png",
    "https://upload.wikimedia.org/wikipedia/en/a/aa/Pok%C3%A9mon_Meowth_art.png",
    "https://upload.wikimedia.org/wikipedia/en/a/a9/Pok%C3%A9mon_Eevee_art.png",
    "https://upload.wikimedia.org/wikipedia/en/4/40/Pok%C3%A9mon_Lapras_art.png",
    "https://upload.wikimedia.org/wikipedia/en/1/1a/Pok%C3%A9mon_Chikorita_art.png",
    "https://upload.wikimedia.org/wikipedia/en/a/aa/Pichu_artwork.png",
    "https://upload.wikimedia.org/wikipedia/en/5/53/Pok%C3%A9mon_Togepi_art.png",
    "https://upload.wikimedia.org/wikipedia/en/2/22/Pok%C3%A9mon_Mudkip_art.png",
  ];

  let img_src =
    default_images[Math.floor(Math.random() * default_images.length)];

  state.subscribe((new_state) => {
    while (new_state.users.some((u) => u.img_src == img_src)) {
      img_src =
        default_images[Math.floor(Math.random() * default_images.length)];
    }
  });

  async function onTelegramAuth(user: TelegramUser) {
    username = user.username || user.first_name + " " + user.last_name;
    console.log(JSON.stringify(user, null, 2));
    img_src = user.photo_url || img_src;
    console.log("Image src: " + img_src);
    await onManualAuth();
  }

  async function onManualAuth() {
    if (!prompt) {
      alert("Write prompt first!");
      return;
    }
    if (!username) {
      alert("Empty username");
      return;
    }
    if (!img_src) {
      alert("Empty image");
      return;
    }
    console.log("dispatching");
    prompt = prompt.toUpperCase().trim();
    try {
      await socket.login(username, img_src, prompt);
    } catch (error) {
      alert(error);
      return;
    }
    my_username.set(username);
    console.log("Logged in: ", username, img_src, prompt);
    let tg_login = document.getElementById("telegram-login-minnybot");
    if (tg_login?.parentNode) tg_login.parentNode.removeChild(tg_login);
  }

  async function relogin() {
    if (!username) {
      alert("Empty username");
      return;
    }
    try {
      await socket.relogin(username);
    } catch (error) {
      alert(error);
      return;
    }
    my_username.set(username);
    console.log("Relogged in: ", username);
    let tg_login = document.getElementById("telegram-login-minnybot");
    if (tg_login?.parentNode) tg_login.parentNode.removeChild(tg_login);
  }

  async function late_login() {
    if (!username) {
      alert("Empty username");
      return;
    }
    if (!img_src) {
      alert("Empty image");
      return;
    }
    try {
      await socket.late_login(username, img_src);
    } catch (error) {
      alert(error);
      return;
    }
    my_username.set(username);
    console.log("Late logged in: ", username, img_src);
    let tg_login = document.getElementById("telegram-login-minnybot");
    if (tg_login?.parentNode) tg_login.parentNode.removeChild(tg_login);
  }

  let login_type: "login" | "relogin" | "late login" = "login";

  onMount(async () => {
    // @ts-ignore: I know I should find a better way, but this works
    window.onTelegramAuth = onTelegramAuth;
  });
</script>

{#if $state.phase === "login"}
  <div class="row">
    <div class="col sm-4">
      <div class="form-group">
        <label for="paperInputs2">Username</label>
        <input
          id="username-input"
          bind:value={username}
          class="input-block"
          type="text"
          placeholder="Username"
          required
        />
      </div>
    </div>
    <div class="col sm-8">
      <div class="form-group">
        <label for="paperInputs3">Image url</label>
        <input
          id="image-url-input"
          bind:value={img_src}
          class="input-block"
          type="url"
          required
        />
      </div>
    </div>
  </div>
  <div class="row">
    <input
      bind:value={prompt}
      class="width-100 input-block"
      type="text"
      placeholder="Your prompt"
      on:keyup={(key) => (key.code === "Enter" ? onManualAuth() : null)}
      required
    />
  </div>
  <button on:click={onManualAuth} class="width-60 btn-block">Login</button>
{:else if login_type === "login"}
  <div class="centered-flex">
    <button on:click={() => (login_type = "late login")}>
      Login as new player
    </button>
    <button on:click={() => (login_type = "relogin")}>
      Login as existing player
    </button>
  </div>
{:else if login_type === "late login"}
  <button on:click={() => (login_type = "relogin")}>
    Login as existing player
  </button>
  <div class="row">
    <div class="col sm-4">
      <div class="form-group">
        <label for="paperInputs2">Username</label>
        <input
          id="username-input"
          bind:value={username}
          class="input-block"
          type="text"
          placeholder="Username"
          required
        />
      </div>
    </div>
    <div class="col sm-8">
      <div class="form-group">
        <label for="paperInputs3">Image url</label>
        <input
          id="image-url-input"
          bind:value={img_src}
          class="input-block"
          type="url"
          required
        />
      </div>
    </div>
  </div>
  <div class="col">
    <button on:click={late_login}>Login as new player</button>
  </div>
{:else}
  <button on:click={() => (login_type = "late login")}>
    Login as new player
  </button>
  <div class="row">
    <div class="col sm-6">
      <select bind:value={username}>
        <option disabled={true} selected={true} value="">
          Select username
        </option>
        {#each $state.users as user}
          <option value={user.username}>
            {user.username}
          </option>
        {/each}
      </select>
    </div>
    <div class="col sm-6">
      <button on:click={relogin} disabled={!username} class="btn-block">
        Login as {username}
      </button>
    </div>
  </div>
{/if}

<style>
  button {
    margin: 1em;
  }
  select {
    margin: 1em;
    width: 100%;
  }

  .width-60 {
    max-width: 60%;
    margin: auto;
  }

  .width-100 {
    width: 100%;
    margin: auto;
  }
</style>
