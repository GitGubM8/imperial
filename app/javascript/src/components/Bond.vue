<template>
  <div
    :class="'m-1 border-2 border-' + border() +'-500 p-1 tooltip bg-' + backgroundColor()"
    :style="filter === 'grayscale' ? {filter: 'grayscale(1)'} : {}"
    @click="$emit('click', bond)"
  >
    <Flag
      :nation="nation"
      width="30"
      height="20"
    />
    {{ bond.number }}:{{ bond.cost }}
    <div
      v-if="canBePurchased && !isBeingAppliedToTradeIn"
      class="tooltip-text border border-green-500 p-1 rounded mt-3 bg-white"
    >
      Purchase for {{ bond.cost }}m.
    </div>
    <div
      v-if="canBePurchased && isBeingAppliedToTradeIn"
      class="tooltip-text border border-green-500 p-1 rounded mt-3 bg-white"
    >
      Purchase for {{ bond.cost - tradedInValue }}m plus the {{ tradedInValue }}m bond.
    </div>
  </div>
</template>

<script>
import Flag from './flags/Flag.vue';

export default {
  name: 'Bond',
  components: { Flag },
  props: {
    toggleTradeIn: { type: Function, default: () => {} },
    tradedInValue: { type: Number, default: 0 },
    bond: { type: Object, default: () => {} },
    isBeingAppliedToTradeIn: Boolean,
    filter: { type: String, default: '' },
    canBePurchased: Boolean,
  },
  emits: ['click'],
  computed: {
    nation() {
      if (this.bond.nation.value === 'CN' && this.bond.nation.label === 'NationAsia') {
        return 'CNAsia';
      }
      return this.bond.nation.value;
    },
  },
  methods: {
    backgroundColor() {
      if (this.bond.nation.value === 'GE' && this.bond.nation.label === 'NationAsia') {
        return 'GEAsia';
      }
      return this.bond.nation.value;
    },
    border() {
      if (this.isBeingAppliedToTradeIn) {
        return 'yellow';
      }
      return 'green';
    },
  },
};
</script>
