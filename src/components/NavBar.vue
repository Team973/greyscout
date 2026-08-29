<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { RouterLink } from 'vue-router';

import HamburgerMenu from '@/components/HamburgerMenu.vue';

import { useViewModeStore } from '@/stores/view-mode-store';
import { useEventStore } from '@/stores/event-store';
import { useAuthStore } from "@/stores/auth-store";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
</script>

<template>
    <!-- Mobile navigation bar (hamburger menu) -->
    <div class="nav" :class="{ 'nav--hidden': navHidden }" v-if="viewMode?.isMobile && isLoggedIn">
        <HamburgerMenu>
            <template v-slot:menu-title>
                {{ eventName }}
            </template>
            <template v-slot:theme-button>
                <div class="nav-dark-mode nav-mobile-right" @click="toggleUserDarkMode">
                    <md-icon slot="icon" v-if="isDarkMode">dark_mode</md-icon>
                    <md-icon slot="icon" v-else>light_mode</md-icon>
                </div>
            </template>
            <template v-slot:menu-content>
                <!-- <RouterLink to="/upload" class="nav-link nav-link-mobile" v-if="isWriteAccess">Data Upload</RouterLink> -->
                <RouterLink v-if="isMember" to="/schedule" class="nav-link nav-link-mobile">Schedule</RouterLink>
                <RouterLink to="/data-status" class="nav-link nav-link-mobile">Data Status</RouterLink>
                <RouterLink v-if="isMember" to="/pit" class="nav-link nav-link-mobile">Pit Scouting</RouterLink>
                <RouterLink v-if="isMember" to="/match" class="nav-link nav-link-mobile">Match Scouting</RouterLink>
                <!-- <RouterLink to="/event" class="nav-link nav-link-mobile">Event Analysis</RouterLink> -->
                <RouterLink to="/team" class="nav-link nav-link-mobile">Team Analysis</RouterLink>
                <RouterLink v-if="isMember" to="/picklist" class="nav-link nav-link-mobile">Pick List</RouterLink>
                <RouterLink v-if="isLead" to="/strategy" class="nav-link nav-link-mobile">Strategy</RouterLink>
                <!-- <RouterLink to="/chartbuilder" class="nav-link nav-link-mobile">ChartBuilder</RouterLink> -->
                <RouterLink to="/account" class="nav-link nav-link-mobile">Account</RouterLink>
            </template>
        </HamburgerMenu>

    </div>
    <div class="nav" :class="{ 'nav--hidden': navHidden }" v-else-if="viewMode?.isMobile && !isLoggedIn">
        <HamburgerMenu>
            <template v-slot:menu-title>
                <RouterLink to="/" class="nav-link">GreyScout</RouterLink>
            </template>
            <template v-slot:theme-button>
                <div class="nav-dark-mode nav-mobile-right" @click="toggleUserDarkMode">
                    <md-icon slot="icon" v-if="isDarkMode">dark_mode</md-icon>
                    <md-icon slot="icon" v-else>light_mode</md-icon>
                </div>
            </template>
            <template v-slot:menu-content>
                <RouterLink to="/login" class="nav-link nav-link-mobile">Login</RouterLink>
                <RouterLink to="/register" class="nav-link nav-link-mobile">Register</RouterLink>
            </template>
        </HamburgerMenu>
    </div>
    <div class="nav" :class="{ 'nav--hidden': navHidden }" v-else-if="!viewMode?.isMobile && isLoggedIn">
        <!-- <RouterLink to="/upload" class="nav-link" v-if="isWriteAccess">Data Upload</RouterLink> -->
        <RouterLink v-if="isMember" to="/schedule" class="nav-link">Schedule</RouterLink>
        <RouterLink to="/data-status" class="nav-link">Data Status</RouterLink>
        <RouterLink v-if="isMember" to="/pit" class="nav-link">Pit Scouting</RouterLink>
        <RouterLink v-if="isMember" to="/match" class="nav-link">Match Scouting</RouterLink>
        <!-- <RouterLink to="/event" class="nav-link">Event Analysis</RouterLink> -->
        <RouterLink to="/team" class="nav-link">Team Analysis</RouterLink>
        <RouterLink v-if="isMember" to="/picklist" class="nav-link">Pick List</RouterLink>
        <RouterLink v-if="isLead" to="/strategy" class="nav-link">Strategy</RouterLink>
        <!-- <RouterLink to="/chartbuilder" class="nav-link">ChartBuilder</RouterLink> -->

        <div class="nav-dark-mode nav-right" @click="toggleUserDarkMode">
            <md-icon slot="icon" v-if="isDarkMode">dark_mode</md-icon>
            <md-icon slot="icon" v-else>light_mode</md-icon>
        </div>
        <div class="nav-text nav-right">{{ eventName }}</div>
        <div class="nav-online-dot nav-right" :class="isOnline ? 'nav-online-dot--online' : 'nav-online-dot--offline'"
            :title="isOnline ? 'Online' : 'Offline'"></div>
        <div class="nav-dark-mode nav-right" @click="userLogin">
            <md-icon slot="icon" v-if="!isLoggedIn">login</md-icon>
            <md-icon slot="icon" v-else>account_circle</md-icon>
        </div>
    </div>
    <div class="nav" :class="{ 'nav--hidden': navHidden }" v-else>
        <RouterLink to="/" class="nav-link">GreyScout</RouterLink>

        <div class="nav-dark-mode nav-right" @click="userLogin">
            <md-icon slot="icon" v-if="!isLoggedIn">login</md-icon>
            <md-icon slot="icon" v-else>account_circle</md-icon>
        </div>

        <div class="nav-dark-mode nav-right" @click="toggleUserDarkMode">
            <md-icon slot="icon" v-if="isDarkMode">dark_mode</md-icon>
            <md-icon slot="icon" v-else>light_mode</md-icon>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    props: {
        searchVisible: {
            default: true,
            type: Boolean
        }
    },
    data() {
        return {
            windowWidth: window.innerWidth,
            viewMode: null,
            eventStore: null,
            authStore: null,
            queueStore: null,
            isOnline: navigator.onLine,
            // Hidden while scrolling down, shown again while scrolling up —
            // see handleScroll below.
            navHidden: false,
            lastScrollTop: 0,
            scrollContainer: null
        }
    },
    created() {
        this.viewMode = useViewModeStore();
        this.eventStore = useEventStore();

        this.authStore = useAuthStore();
        this.authStore.checkUser();

        this.queueStore = useOfflineQueueStore();

        window.addEventListener('online', () => { this.isOnline = true; });
        window.addEventListener('offline', () => { this.isOnline = false; });
    },
    mounted() {
        // The whole SPA scrolls inside #app (position: fixed + overflow:
        // auto in main.css), not the window — window scroll events never
        // fire here, so the listener has to target #app directly.
        this.scrollContainer = document.getElementById('app') || document.scrollingElement || document.documentElement;
        this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
    },
    beforeUnmount() {
        this.scrollContainer?.removeEventListener('scroll', this.handleScroll);
    },
    computed: {
        eventName() {
            return this.eventStore?.eventName;
        },
        isDarkMode() {
            return this.viewMode.isDarkMode;
        },
        isLoggedIn() {
            return this.authStore?.isUserLoggedIn;
        },
        isWriteAccess() {
            return this.authStore?.isWriteAuthorized;
        },
        isMember() {
            return this.authStore?.isMember;
        },
        isLead() {
            return this.authStore?.isLead;
        }
    },
    methods: {
        // Hides the nav while scrolling down (past its own height, so it
        // never hides right at the top of a short page), shows it again on
        // any scroll up — a small dead zone (SCROLL_DELTA) ignores jitter
        // from momentum/rubber-band scrolling so it doesn't flicker.
        handleScroll() {
            const SCROLL_DELTA = 4;
            const NAV_HEIGHT = 65;
            const scrollTop = Math.max(0, this.scrollContainer.scrollTop);
            const delta = scrollTop - this.lastScrollTop;

            if (scrollTop <= NAV_HEIGHT) {
                this.navHidden = false;
            } else if (delta > SCROLL_DELTA) {
                this.navHidden = true;
            } else if (delta < -SCROLL_DELTA) {
                this.navHidden = false;
            }

            this.lastScrollTop = scrollTop;
        },
        toggleUserDarkMode() {
            this.viewMode.toggleUserDarkMode();
        },
        userLogin() {
            if (this.isLoggedIn) {
                this.$router.push("/account");
                return;
            }

            this.$router.push("/login");
        }
    }
}
</script>

<style scoped>
div.nav {
    background-color: var(--header-color);
    color: var(--primary-text-color);
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    width: 100%;
    height: 65px;
    position: fixed;
    display: block;
    transform: translateY(0);
    transition: transform 0.3s ease;
}

div.nav.nav--hidden {
    transform: translateY(-100%);
}


a.nav-link {
    /* Color transitions */
    transition: color .5s ease;
    transition: background-color .5s ease;
    -ms-transition: color .5s ease;
    -ms-transition: background-color .5s ease;
    -moz-transition: color .5s ease;
    -moz-transition: background-color .5s ease;
    -webkit-transition: color .5s ease;
    -webkit-transition: background-color .5s ease;

    /* Border transitions */
    /* -webkit-transition: border .5s ease;
    -moz-transition: border .5s ease;
    transition: border .5s ease; */

    /* Positioning */
    position: relative;
    margin: 0 auto;
    float: left;
    display: flex;
    justify-content: center;
    align-items: center;

    /* Sizing */
    font-size: 16px;
    height: 100%;
    text-align: center;
    margin: 0 auto;
    padding-left: 10px;
    padding-right: 10px;

    /* Text */
    text-decoration: none;
}


a.nav-link:link,
a.nav-link:visited {
    background-color: var(--header-color);
    color: #FFF;
    border-bottom: var(--header-color) 5px solid;
}

a.nav-link:hover,
a.nav-link:active {
    background-color: var(--header-hover-color);
    color: #FFF;
    border-bottom: var(--primary-color) 5px solid;
}

a.nav-link-mobile {
    width: 100%;
    padding: 15px;
}

.nav-right {
    display: flex;
    align-items: center;
    float: right;
    position: relative;
    height: 100%;
    background-color: var(--accent-color);
    padding: 20px;
}

.nav-mobile-right {
    display: flex;
    align-items: center;
    float: right;
    position: relative;
    height: 100%;
    padding: 20px;
}

.nav-text {
    font-size: 16px;
    text-decoration: none;
    color: #FFF;
}

.nav-dark-mode {
    background-color: var(--primary-color);
    color: var(--header-theme-toggle-text-color);
    cursor: pointer;
}

.nav-dark-mode:hover {
    background-color: var(--header-auxillary-button-hover-color);
}

.nav-online-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
}

.nav-online-dot--online {
    background-color: #3ab83a;
    box-shadow: 0 0 0 2px rgba(58, 184, 58, 0.35);
}

.nav-online-dot--offline {
    background-color: #e05050;
    box-shadow: 0 0 0 2px rgba(224, 80, 80, 0.35);
}
</style>