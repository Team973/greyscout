<script setup lang="ts">
// @ts-nocheck
import PreScoutForm from "@/components/PreScoutForm.vue";

import { useEventStore } from "@/stores/event-store";
import { useAuthStore } from "@/stores/auth-store";
import { fetchTeamPreScoutData } from "@/lib/prescout-query";

import "@material/web/button/filled-button";
</script>

<template>
    <div class="prescout-section">
        <h1>Pre-Scouting</h1>

        <PreScoutForm v-if="prescoutFormMode !== 'view'" :team-number="teamNumber"
            :pre-scout-data-id="prescoutFormMode === 'edit' ? prescoutFormEditId : null" @saved="onPrescoutFormSaved"
            @cancel="onPrescoutFormCancel">
        </PreScoutForm>

        <template v-else>
            <div v-if="prescoutSaveMessage" class="data-tile notification-tile prescout-save-message">{{ prescoutSaveMessage }}</div>

            <div v-if="!teamPrescoutDataLoaded">Loading pre-scouting data…</div>
            <div v-else-if="teamPrescoutData.length === 0" class="no-comments">
                <p>No pre-scouting data yet.</p>
                <md-filled-button v-if="isUserWriteAccess" v-on:click="startAddPrescout">Pre-Scout This
                    Team</md-filled-button>
            </div>
            <template v-else>
                <div class="prescout-actions" v-if="isUserWriteAccess">
                    <md-filled-button v-on:click="startEditPrescout(teamPrescoutData[0].id)">Edit</md-filled-button>
                </div>
                <ul class="prescout-list">
                    <li v-for="(entry, idx) in teamPrescoutData" :key="idx" class="prescout-card">
                        <div class="prescout-stats-grid">
                            <div class="prescout-stat">
                                <div class="prescout-stat-label">Pre-Event EPA</div>
                                <div class="prescout-stat-value">{{ entry.epa ?? '—' }}</div>
                            </div>
                            <div class="prescout-stat">
                                <div class="prescout-stat-label">Archetype</div>
                                <div class="prescout-stat-value">{{ formatArchetype(entry.archetype) }}</div>
                            </div>
                            <div class="prescout-stat">
                                <div class="prescout-stat-label">Scoring Tier</div>
                                <div class="prescout-stat-value">{{ entry.scoringTier ?? '—' }}</div>
                            </div>
                            <div class="prescout-stat">
                                <div class="prescout-stat-label">Driving Tier</div>
                                <div class="prescout-stat-value">{{ entry.drivingTier ?? '—' }}</div>
                            </div>
                            <div class="prescout-stat">
                                <div class="prescout-stat-label">Defense Tier</div>
                                <div class="prescout-stat-value">{{ entry.defenseTier ?? '—' }}</div>
                            </div>
                        </div>
                        <p v-if="entry.comments" class="prescout-comments">{{ entry.comments }}</p>
                        <div class="prescout-author">Scouted by {{ entry.author }}</div>
                    </li>
                </ul>
            </template>
        </template>
    </div>
</template>

<script lang="ts">
export default {
    props: {
        teamNumber: {
            type: Number,
            required: true
        },
        // Auto-opens the edit form for this team's newest pre-scouting entry
        // once loaded — used by Data Status's lead-only edit shortcut
        // (issue #51, mirroring PitScoutingSection.vue's autoEdit from #31).
        autoEdit: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            eventStore: null,
            authStore: null,
            teamPrescoutData: [],
            teamPrescoutDataLoaded: false,
            prescoutFormMode: 'view',
            prescoutFormEditId: null,
            prescoutSaveMessage: '',
            prescoutSaveMessageTimeout: null
        }
    },
    methods: {
        async loadTeamPrescoutData() {
            if (this.teamNumber < 0) {
                this.teamPrescoutData = [];
                this.teamPrescoutDataLoaded = true;
                return;
            }

            this.teamPrescoutDataLoaded = false;
            this.teamPrescoutData = await fetchTeamPreScoutData(this.teamNumber, this.eventStore.eventId);
            this.teamPrescoutDataLoaded = true;

            if (this.autoEdit && this.teamPrescoutData.length > 0 && this.isUserWriteAccess) {
                this.startEditPrescout(this.teamPrescoutData[0].id);
            }
        },
        startAddPrescout() {
            this.prescoutFormMode = 'add';
            this.prescoutFormEditId = null;
        },
        startEditPrescout(id: number) {
            this.prescoutFormMode = 'edit';
            this.prescoutFormEditId = id;
        },
        onPrescoutFormCancel() {
            // Reached via Data Status's edit shortcut — cancelling returns
            // there rather than falling back to this team's view mode.
            if (this.autoEdit) {
                this.$router.push('/data-status');
                return;
            }
            this.prescoutFormMode = 'view';
            this.prescoutFormEditId = null;
        },
        async onPrescoutFormSaved({ queuedOffline }: { queuedOffline: boolean }) {
            if (this.autoEdit) {
                this.$router.push('/data-status');
                return;
            }

            this.prescoutFormMode = 'view';
            this.prescoutFormEditId = null;

            if (this.prescoutSaveMessageTimeout) {
                clearTimeout(this.prescoutSaveMessageTimeout);
            }
            this.prescoutSaveMessage = queuedOffline ? "Couldn't save — queued for sync." : "Saved!";
            this.prescoutSaveMessageTimeout = setTimeout(() => {
                this.prescoutSaveMessage = '';
            }, 4000);

            await this.loadTeamPrescoutData();
        },
        formatArchetype(key) {
            const labels = { turret: 'Turret', dumper: 'Dumper', defense: 'Defense' };
            return labels[key] ?? key ?? '—';
        }
    },
    computed: {
        isUserWriteAccess() {
            return this.authStore.isWriteAuthorized;
        }
    },
    watch: {
        teamNumber() {
            this.prescoutFormMode = 'view';
            this.prescoutFormEditId = null;
            this.loadTeamPrescoutData();
        }
    },
    created() {
        this.eventStore = useEventStore();
        this.authStore = useAuthStore();
        this.authStore.checkUser();
        this.loadTeamPrescoutData();
    }
}
</script>

<style scoped>
.prescout-section {
    margin-top: 24px;
}

.prescout-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 10px;
}

.prescout-save-message {
    margin-bottom: 14px;
}

.prescout-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.prescout-card {
    background: var(--tile-background-color);
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 10px;
    padding: 12px 14px;
}

.prescout-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 10px;
}

.prescout-stat-label {
    font-size: 11px;
    color: rgba(128, 128, 128, 0.75);
    margin-bottom: 2px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.prescout-stat-value {
    font-size: 15px;
    font-weight: 700;
    color: var(--primary-text-color);
}

.prescout-comments {
    margin-top: 10px;
    font-size: 13px;
    color: var(--primary-text-color);
    line-height: 1.5;
}

.prescout-author {
    margin-top: 10px;
    font-size: 11px;
    color: rgba(128, 128, 128, 0.6);
}

.no-comments {
    font-size: 13px;
    color: rgba(128, 128, 128, 0.7);
    font-style: italic;
}
</style>
