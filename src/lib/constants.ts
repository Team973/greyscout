
// Site visibility
export const isSiteReadPrivate = true;
export const isSiteWritePrivate = true;

// Supabase project
export const projectId = "ezliacqrdzidhlmqfmee";
export const publicKey = "sb_publishable_s5t5ajQm1nTjO6BOGov-Ug_b1lWwq94";

// Database tables
export const matchScoutUploadTable = "MatchDataUploaded";
export const matchScoutTable = matchScoutUploadTable;
export const pitScoutTable = "PitData";
export const eventInfoTable = "Event";
export const teamInfoTable = "Team";
export const robotPhotoTable = "RobotPhoto";
export const userTable = "User";

// Database columns
export const teamNumberColumn = "prematch_team_number";
export const matchNumberColumn = "prematch_match_number";

// Storage buckets
export const robotPhotoBucket = "robot-photos";

// Default team number
export const defaultTeamNumber = 973;

// Event information.
export const defaultEventId = "2025cafr";
// Flag to force override to the default event. Useful if you are playing two tournaments on the same day.
export const useDefaultEvent = true;


// View mode options.
export const minWidthForDesktop = 820;