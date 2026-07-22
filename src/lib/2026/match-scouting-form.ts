// @ts-nocheck

import { getTeamInputElement } from "@/lib/data-submission";

export async function getMatchScoutSchema() {
    const teamInputElement = await getTeamInputElement();

    return [
        {
            key: "prematch",
            name: "Pre-match",
            components: [
                {
                    key: "match_number",
                    label: "Match Number",
                    type: "number",
                    options: {},
                    defaultValue: null,
                    value: null,
                    preserveAfterSubmit: false,
                    incrementAfterSubmit: true,
                    required: true,
                    error: false
                },
                teamInputElement,
                {
                    key: "alliance",
                    label: "Alliance",
                    type: "optionswitch",
                    options: {
                        unselected: "Red",
                        selected: "Blue",
                    },
                    defaultValue: false,
                    value: false,
                    preserveAfterSubmit: false,
                    incrementAfterSubmit: false,
                    required: false,
                    error: false
                },
                {
                    key: "noshow",
                    label: "No Show",
                    type: "switch",
                    options: {},
                    defaultValue: false,
                    value: false,
                    preserveAfterSubmit: false,
                    incrementAfterSubmit: false,
                    required: false,
                    error: false
                },
            ]
        },
        {
            key: "postmatch",
            name: "Post Match",
            components: [
                {
                    key: "cards",
                    label: "Cards?",
                    type: "dropdown",
                    options: {
                        choices: [
                            { key: "none", text: "No Card" },
                            { key: "yellow", text: "Yellow Card" },
                            { key: "red", text: "Red Card" },
                        ]
                    },
                    defaultValue: 0,
                    value: 0,
                    preserveAfterSubmit: false,
                    incrementAfterSubmit: false,
                    required: false,
                    error: false
                },
                {
                    key: "comments",
                    label: "Comments",
                    type: "textarea",
                    options: {},
                    defaultValue: "",
                    value: "",
                    preserveAfterSubmit: false,
                    incrementAfterSubmit: false,
                    required: true,
                    error: false
                },
            ]
        }
    ];
} 