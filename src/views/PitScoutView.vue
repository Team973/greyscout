<script setup lang="ts">
// @ts-nocheck
import FormSection from "@/components/FormSection.vue";

import { pitScoutTable } from "@/lib/constants";
import { getPitScoutSchema } from "@/lib/2026/pit-scouting-form";
import { validateForm, parseScoutData, submitScoutData } from "@/lib/data-submission";
import { useEventStore } from "@/stores/event-store";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";

import "@material/web/button/filled-button";
</script>

<template>
    <div class="main-content">
        <h1>Pit Scouting</h1>

        <form v-if="formLoaded">
            <FormSection v-for="section in scoutForm" :section-key="section.key" :name="section.name"
                :components="section.components" color="gray" @form-update="formValidation"></FormSection>
        </form>

        <div class="data-tile error-tile" v-if="formInvalid">
            <h1>^^^ Form is invalid. Please check the form for errors ^^^</h1>
        </div>
        <div class="data-tile success-tile" v-if="submitSuccess">
            <h1>Submitted successfully!</h1>
        </div>
        <div class="data-tile notification-tile" v-if="resetSuccess">
            <h1>Reset form successfully!</h1>
        </div>

        <div class="data-tile notification-tile" v-if="queuedOffline">
            <h1>Couldn't submit — saved locally</h1>
            <p>This entry has been queued and will sync automatically once you're back online. You can keep
                scouting in the meantime.</p>
        </div>

        <div class="button-container" v-if="formLoaded && !isSubmitting">
            <md-filled-button v-on:click="resetFormData" class="reset-button">RESET</md-filled-button>
            <md-filled-button v-on:click="submitForm" class="submit-button">SUBMIT</md-filled-button>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    data() {
        return {
            eventStore: null,
            queueStore: null,
            scoutForm: null,
            formLoaded: false,
            // Track data submission separately from the act of submitting, so it can
            // be queued locally if the submission fails.
            submitData: {},
            submitSuccess: false,
            queuedOffline: false,
            formInvalid: false,
            isSubmitting: false,
            resetSuccess: false
        }
    },
    methods: {
        async loadForm() {
            this.formLoaded = false;
            this.scoutForm = await getPitScoutSchema();
            this.formLoaded = true;
        },
        formValidation() {
            // The form isn't invalid yet.
            this.formInvalid = false;

            const { data, valid } = validateForm(this.scoutForm);
            this.scoutForm = data;
            this.formInvalid = !valid;

            // reset the submit/reset success flag because the form has changed and has not been submitted yet.
            this.submitSuccess = false;
            this.resetSuccess = false;

            return valid;
        },
        async submitForm() {
            // Data submission hasn't failed or succeeded yet...
            this.queuedOffline = false;
            this.submitSuccess = false;
            this.isSubmitting = true;
            this.resetSuccess = false;

            // If the form isn't valid, wait for the user to fix it.
            if (!this.formValidation()) {
                this.isSubmitting = false;
                return;
            }

            // Parse the data to submit separately from the act of submitting the data to the database in case the connection fails.
            this.submitData = parseScoutData(this.scoutForm, this.eventStore.eventId)

            // Attempt to submit the data.
            const error = await submitScoutData(this.submitData, pitScoutTable);

            // Preserve some things that don't need to be re-entered.
            this.preserveSingleEntryData();

            // If the database submission failed, queue it locally for retry instead of blocking the scout.
            if (error) {
                console.log(error);
                this.queueStore.enqueue('scout_data', { table: pitScoutTable, data: this.submitData }, error.message ?? String(error));

                // The data is safely queued — let the scout move on.
                // (resetFormData() clears queuedOffline, so set it true afterward.)
                this.resetFormData();
                this.queuedOffline = true;
                this.submitData = {};
                this.isSubmitting = false;
                return;
            }

            // Reset all non-preserved data.
            this.resetFormData();

            // Mark the submission as successful and reset the submission data.
            this.submitSuccess = true;
            this.submitData = {};
            this.isSubmitting = false;
        },
        preserveSingleEntryData() {
            // Iterate over all components and set their default values to be whatever was submitted most recently.
            this.scoutForm.forEach(section => {
                section.components.forEach(component => {
                    if (component.preserveAfterSubmit) {
                        component.defaultValue = component.value;
                    }
                })
            });
        },
        resetFormData() {
            // Reset all data to their default values.
            this.scoutForm.forEach(section => {
                section.components.forEach(component => {
                    component.value = component.defaultValue;
                    component.error = false;
                })
            });

            // The form submission no longer has failed since the data is being reset.
            this.queuedOffline = false;
            this.formInvalid = false;
            this.submitSuccess = false;
            this.resetSuccess = true;
        }
    },
    created() {
        this.eventStore = useEventStore();
        this.queueStore = useOfflineQueueStore();
        this.loadForm();
    }
}
</script>

<style scoped>
.button-container {
    display: flex;
    justify-content: safe center;
    align-items: safe center;
    width: 100%;
}

md-filled-button {
    margin: 10px;
}

p {
    overflow-wrap: anywhere;
}

.error-tile {
    background-color: red;
    color: white;
}

.success-tile {
    background-color: green;
    color: white;
}

.notification-tile {
    background-color: rgb(88, 88, 232);
    color: white
}
</style>
