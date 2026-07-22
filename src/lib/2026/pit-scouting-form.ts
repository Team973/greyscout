// @ts-nocheck

import { getTeamInputElement } from "@/lib/data-submission";

export async function getPitScoutSchema() {
    const teamInputElement = await getTeamInputElement();

    return [
        {
            key: "pit",
            name: "",
            components: [
                teamInputElement,
                {
                    key: "drivetrain",
                    label: "Drivetrain Type",
                    type: "dropdown",
                    options: {
                        choices: [
                            { key: "swerve", text: "Swerve" },
                            { key: "tank", text: "Tank" },
                            { key: "mecanum", text: "Mecanum" },
                            { key: "other", text: "Other" }
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
                    key: "weight",
                    label: "Weight (lbs)",
                    type: "number",
                    options: {},
                    defaultValue: null,
                    value: null,
                    preserveAfterSubmit: false,
                    incrementAfterSubmit: false,
                    required: true,
                    error: false
                },
                {
                    key: "language",
                    label: "Programming Language",
                    type: "dropdown",
                    options: {
                        choices: [
                            { key: "none", text: "Select language..." },
                            { key: "java", text: "Java" },
                            { key: "cpp", text: "C++" },
                            { key: "python", text: "Python" },
                            { key: "other", text: "Other" }
                        ]
                    },
                    defaultValue: 0,
                    value: 0,
                    preserveAfterSubmit: false,
                    incrementAfterSubmit: false,
                    required: true,
                    error: false
                },
                {
                    key: "vibe_check",
                    label: "Vibe Check",
                    type: "radio",
                    options: {
                        choices: [
                            { key: "1", text: "1" },
                            { key: "2", text: "2" },
                            { key: "3", text: "3" },
                            { key: "4", text: "4" },
                            { key: "5", text: "5" }
                        ],
                        isVertical: false
                    },
                    defaultValue: '',
                    value: '',
                    preserveAfterSubmit: false,
                    incrementAfterSubmit: false,
                    required: true,
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
        },
    ];
}
