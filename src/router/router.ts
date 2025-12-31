// TODO: fix types
// @ts-nocheck

import { createRouter, createWebHistory } from "vue-router";
import MatchScoutView from "@/views/MatchScoutView.vue";
import PitScoutView from "@/views/PitScoutView.vue";
import TeamAnalysisView from "@/views/TeamAnalysisView.vue";
import EventAnalysisView from "@/views/EventAnalysisView.vue";
import MatchPreviewView from "@/views/MatchPreviewView.vue";
import CustomDataVisualizationView from "@/views/CustomDataVisualizationView.vue";
import LoginView from "@/views/LoginView.vue";
import AccountView from "@/views/AccountView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "Home",
      component: EventAnalysisView,
    },
    // {
    //   path: "/scout",
    //   name: "Match Scouting",
    //   component: MatchScoutView,
    // },
    // {
    //   path: "/pit-scout",
    //   name: "Pit Scouting",
    //   component: PitScoutView,
    // },
    {
      path: "/team",
      name: "Team Analysis | GreyScout",
      component: TeamAnalysisView,
    },
    {
      path: "/event",
      name: "Event Analysis | GreyScout",
      component: EventAnalysisView,
    },
    {
      path: "/match",
      name: "Match Preview | GreyScout",
      component: MatchPreviewView,
    },
    {
      path: "/chartbuilder",
      name: "Chart Builder | GreyScout",
      component: CustomDataVisualizationView,
    },
    {
      path: "/login",
      name: "Login | GreyScout",
      component: LoginView,
    },
    {
      path: "/account",
      name: "Account | GreyScout",
      component: AccountView,
    }
  ],
});

router.beforeEach((to, from, next) => {
  document.title = to.name;
  next();
});

export default router;
