<template>
  <div class="p-4">
    <b>Current Games</b>
    <div class="flex justify-between border-b border-black mt-2">
      <div class="w-1/3 sm:w-1/5 mx-2">
        <b>Name</b>
      </div>
      <div class="hidden sm:w-1/5 sm:inline-block mx-2">
        <b>Players</b>
      </div>
      <div class="w-1/3 sm:w-1/5 mx-2">
        <b>Started At</b>
      </div>
      <div class="w-1/3 sm:w-1/5 mx-2">
        <b>Last Move At</b>
      </div>
      <div class="hidden sm:w-1/5 sm:inline-block mx-2" />
    </div>
    <div
      v-for="game of games"
      :key="game.id"
    >
      <router-link
        :to="{ path: '/game/' + game.id }"
        class="flex justify-between items-center hover:bg-yellow-100 py-2"
      >
        <div class="w-1/3 sm:w-1/5 mx-2">
          {{ game.name }}
        </div>
        <div class="hidden sm:w-1/5 sm:inline-block mx-2">
          {{ game.players.length }}
        </div>
        <div class="w-1/3 sm:w-1/5 mx-2">
          {{ toTime(game.startedAt) }}
        </div>
        <div class="w-1/3 sm:w-1/5 mx-2">
          {{ toTime(game.lastMoveAt) }}
        </div>
        <div class="hidden sm:w-1/5 sm:inline-block mx-2">
          {{ variant(game.baseGame) }}
        </div>
      </router-link>
    </div>
  </div>
</template>

<script>
import toTime from '../toTime';

export default {
  name: 'CurrentGames',
  props: { games: { type: Array, default: () => [] } },
  methods: {
    toTime(date) {
      return toTime(date);
    },
    variant(baseGame) {
      if (baseGame === 'imperial') {
        return 'Imperial';
      } if (baseGame === 'imperial2030') {
        return 'Imperial 2030';
      } if (baseGame === 'imperialAsia') {
        return 'Imperial Asia';
      }
      return '';
    },
  },
};
</script>
