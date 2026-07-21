<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import "@material/web/button/filled-button";
import TextInput from '@/components/TextInput.vue';

import { supabase } from "@/lib/supabase-client";

import { useAuthStore, roleRank } from "@/stores/auth-store";
import { fetchAllUsers, updateUserRole } from "@/lib/user-query";
</script>

<template>
    <div class="main-content">
        <div class="user-tile">
            <h1>Profile</h1>
            <div>Name: {{ authStore.currentUserName || '(no name on file)' }}</div>
            <div>Role: {{ authStore.role }}</div>
        </div>

        <div class="user-tile">
            <h1>Access</h1>
            <div>
                Can Write: {{ authStore.isWriteAuthorized }}
            </div>
        </div>

        <div class="user-tile">
            <h1>People</h1>
            <div v-if="!peopleLoaded">Loading people…</div>
            <div v-else-if="people.length === 0">No other users found.</div>
            <table v-else class="people-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="person in people" :key="person.user_id">
                        <td>{{ person.name || 'Unnamed user' }}</td>
                        <td class="people-role">{{ person.role }}</td>
                        <td>
                            <select v-if="person.user_id !== authStore.currentUserId && allowedRoles(person.role).length > 0"
                                :value="pendingRole[person.user_id] || ''"
                                @change="changeRole(person, $event.target.value)">
                                <option disabled value="">Change role…</option>
                                <option v-for="r in allowedRoles(person.role)" :key="r" :value="r">{{ r }}</option>
                            </select>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p v-if="peopleError" class="form-error">{{ peopleError }}</p>
        </div>

        <div class="user-tile">
            <h1>Log Out</h1>
            <md-filled-button v-on:click="logOutUser()" class="load-button">Log out</md-filled-button>
        </div>
    </div>
</template>

<script lang="ts">
const ALL_ROLES = ['observer', 'member', 'lead', 'admin'];

export default {
    data() {
        return {
            authStore: null,
            people: [],
            peopleLoaded: false,
            peopleError: "",
            pendingRole: {},
        }
    },
    methods: {
        async loadPeople() {
            this.peopleLoaded = false;
            this.people = await fetchAllUsers();
            this.peopleLoaded = true;
        },
        allowedRoles(targetRole) {
            const actorRank = roleRank[this.authStore.role] ?? -1;
            const oldRank = roleRank[targetRole] ?? -1;

            return ALL_ROLES.filter((candidate) => {
                const newRank = roleRank[candidate];
                if (newRank === oldRank) return false;
                if (newRank > oldRank) {
                    // Promotion: must outrank the target's current role, and cannot
                    // grant a role higher than the actor's own.
                    return actorRank > oldRank && newRank <= actorRank;
                }
                // Relegation (demotion) is admin-only.
                return this.authStore.role === 'admin';
            });
        },
        async changeRole(person, newRole) {
            if (!newRole) return;
            this.peopleError = "";
            const previousRole = person.role;
            this.pendingRole[person.user_id] = newRole;

            const error = await updateUserRole(person.user_id, newRole);

            if (error) {
                this.peopleError = error.message ?? 'Unable to update role.';
                this.pendingRole[person.user_id] = previousRole;
                return;
            }

            person.role = newRole;
            this.pendingRole[person.user_id] = '';
        },
        async logOutUser() {
            const { error } = await supabase.auth.signOut();

            if (error) {
                // TODO
                return;
            }

            this.authStore.checkUser();
            this.$router.push("/event");
        }
    },
    async created() {
        this.authStore = useAuthStore();
        await this.authStore.checkUser();
        await this.loadPeople();
    }
}
</script>

<style scoped>
.user-tile {
    margin-bottom: 20px;
}

.people-table {
    border-collapse: collapse;
    width: 100%;
}

.people-table th,
.people-table td {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}

.people-role {
    text-transform: capitalize;
}

.form-error {
    color: #c0392b;
}
</style>
