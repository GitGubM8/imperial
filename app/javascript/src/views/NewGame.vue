<template>
  <form
    class="flex flex-col mx-auto rounded bg-green-200 max-w-4xl mt-10 p-20"
    @submit="openGame"
  >
    <div class="max-w-2xl self-center">
      <div class="my-2">
        <b>Original Imperial or Imperial 2030</b>
        <div>
          <input
            id="imperial"
            v-model="baseGame"
            type="radio"
            value="imperial"
          >
          <label for="imperial">Original Imperial</label>
        </div>
        <div>
          <input
            id="imperial2030"
            v-model="baseGame"
            type="radio"
            value="imperial2030"
          >
          <label for="imperial2030">Imperial 2030</label>
        </div>
        <div>
          <input
            id="imperialAsia"
            v-model="baseGame"
            type="radio"
            value="imperialAsia"
          >
          <label for="imperial2030">Imperial Asia</label>
        </div>
      </div>
      <div class="my-2">
        <b>Variant</b>
        <div>
          <input
            id="standard"
            v-model="variant"
            type="radio"
            value="standard"
          >
          <label for="standard">Standard (with investor card, no auction)</label>
        </div>
        <div>
          <input
            id="auction"
            v-model="variant"
            type="radio"
            value="auction"
          >
          <label for="auction">Auction (with investor card and auction)</label>
        </div>
        <div>
          <input
            id="withoutInvestorCard"
            v-model="variant"
            type="radio"
            value="withoutInvestorCard"
          >
          <label for="withoutInvestorCard">
            Without Investor Card (with auction, no investor card
          </label>
        </div>
      </div>
      <div class="my-2">
        <b>Is your game public or private?</b>
        <div class="text-sm">
          Public games are listed on the Open Games list.
          Private games can only be joined with the game link.
        </div>
        <div>
          <input
            id="public"
            v-model="isGamePublic"
            type="radio"
            :value="true"
          >
          <label for="public">Public</label>
        </div>
        <div>
          <input
            id="public"
            v-model="isGamePublic"
            type="radio"
            :value="false"
          >
          <label for="private">Private</label>
        </div>
      </div>
      <div class="my-2">
        <b>Do You Want a Discord Channel to Automatically be Created?</b>
        (Optional)
        <div>
          <input
            id="yes"
            v-model="createDiscordChannel"
            type="radio"
            :value="true"
          >
          <label for="yes">Yes</label>
        </div>
        <div>
          <input
            id="no"
            v-model="createDiscordChannel"
            type="radio"
            :value="false"
          >
          <label for="no">No</label>
        </div>
      </div>
      <div class="my-2">
        <input
          type="submit"
          value="New Game"
          class="rounded p-5 bg-green-800 text-white cursor-pointer my-2 text-1xl w-1/2 self-center"
        >
      </div>
    </div>
  </form>
</template>

<script>
import { apiClient } from '../router/index';

export default {
  name: 'NewGame',
  emits: ['openGame'],
  data() {
    return {
      baseGame: 'imperial',
      createDiscordChannel: false,
      isGamePublic: true,
      variant: 'standard',
    };
  },
  created() {
    document.title = 'New Game - Imperial';
  },
  methods: {
    openGame(e) {
      e.preventDefault();
      apiClient.openGame(
        this.$cookies.get('user_id'),
        this.baseGame,
        this.variant,
        this.createDiscordChannel,
        this.isGamePublic,
      )
        .then((game) => {
          this.$emit('openGame', game);
          this.$router.push(`/game/${game.id}`);
        });
    },
  },
};
</script>
