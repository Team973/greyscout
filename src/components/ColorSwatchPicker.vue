<script setup lang="ts">
// @ts-nocheck
</script>

<template>
    <div class="color-swatch-picker">
        <button v-for="(choice, idx) in choices" :key="choice.key" type="button" class="color-swatch-option"
            :class="{ 'color-swatch-option--active': idx === modelValue }" :style="{ backgroundColor: choice.hex }"
            :aria-label="choice.text" :title="choice.text" @click="$emit('update:modelValue', idx)"></button>
    </div>
</template>

<script lang="ts">
// Click-to-pick row of color blocks (issue #32 feedback: a team's color
// should be a visual swatch picker, not a text dropdown).
export default {
    props: {
        choices: {
            type: Array,
            required: true
        },
        modelValue: {
            type: Number,
            required: true
        }
    },
    emits: ["update:modelValue"]
};
</script>

<style scoped>
.color-swatch-picker {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.color-swatch-option {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
}

.color-swatch-option--active {
    border-color: var(--primary-text-color, #fff);
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
}
</style>
