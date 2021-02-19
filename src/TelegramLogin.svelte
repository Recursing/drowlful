<script lang="ts">
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

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
    "https://upload.wikimedia.org/wikipedia/en/2/20/Pok%C3%A9mon_Venusaur_art.png",
    "https://annachromy.com/wp-content/uploads/2020/08/Sisifo-pisa.jpg",
    "https://en.wikipedia.org/wiki/Meowth#/media/File:Pok%C3%A9mon_Meowth_art.png",
  ];

  let img_src = default_images[Math.floor(Math.random() * 5)];

  function onTelegramAuth(user: TelegramUser) {
    username = user.username || user.first_name + " " + user.last_name;
    console.log(JSON.stringify(user, null, 2));
    img_src = user.photo_url || img_src;
    console.log("Image src: " + img_src);
    onManualAuth();
  }

  function onManualAuth() {
    if (!prompt) {
      alert("Write prompt first!");
      return;
    }
    console.log("dispatching");
    dispatch("login", {
      username: username,
      img_src: img_src,
      prompt: prompt,
    });
  }

  onMount(async () => {
    // @ts-ignore: I know I should find a better way, but this works
    window.onTelegramAuth = onTelegramAuth;
  });
</script>

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
  <div class="col sm-10">
    <div class="form-group">
      <input
        bind:value={prompt}
        class="input-block"
        type="text"
        placeholder="Your prompt"
        required
      />
    </div>
  </div>
  <div class="col">
    <button id="login-button" on:click={onManualAuth} class="button is-link"
      >Login</button
    >
  </div>
</div>

<style>
  button {
    margin-top: -10px;
  }
</style>
