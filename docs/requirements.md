# Requirements

## Technologies

* The app shall be written with the Vue.js framework  
* The database of choice shall be supabase  
* TanStack Query and Pinia shall be used to maintain the offline storage in cases where data was unable to make it to supabase

## Performance

* The app shall be usable in low-internet environments  
  * If user inputs fail, they shall be stored locally and synced to the remote database upon restoration of internet connection  
    * The user shall also be able to retry data submission manually  
  * Users shall have the ability to see a queue of the data that has not successfully been submitted to the remote database  
  * The app shall notify the user if it is in offline or online mode

## Roles

There shall be the following roles:

1. Admin \- a power user who has access to everything, including development settings and behind the scenes stuff with the website  
2. Lead \- a user who has access to all non-development related settings  
   1. Scout Lead  
   2. Strat Lead  
   3. Drive Coach  
3. Member \- a user who has limited access based on the scope of their role  
   1. Individual scouts

## Event Data

* Admin users shall have the ability to set the event schedule for the team  
  * There should be a view in the admin dashboard to set all the events for the current season.  
* Static event information shall be loaded from The Blue Alliance into a database prior to an event, and updated automatically (via github actions)  
  * Teams attending the event  
  * Event ID  
  * Event name  
* Dynamic event information shall be updated upon a manual request (via the website itself) from a Lead or Admin user.  
  * Match schedules and results  
  * Current Rankings  
* The app shall automatically determine which event is being attended based on the current date and the end date of all the events in the team’s schedule.  
  * Alternatively, admin users shall have the power to set the event manually

## Pick List

* Members shall be able to make their own pick lists on their accounts  
* Leads shall be able to view aggregation of all user picklists (democratic picklist)  
* Leads shall be able to maintain a “team picklist” which is the official picklist for the team.   
  * There is only 1 team picklist, and the leads can collaborate on it  
* The picklist should be a compact list view of rows containing team number, team name, and a robot picture. If a user taps/clicks on the row, the view should expand to show a bigger version of the robot picture, and any stats / scout comments about the team.  
  * The stats/comments should come from match scouting and pit scouting.  
  * Any comments should be attributed to the user who commented on the team so they can be asked for any clarification

## Match Scouting

* The team being scouted should be selectable from a dropdown from a list of teams attending the active event.  
* Scouts shall be able to leave comments on the team they are scouting  
  * Comments shall be stored in the database and associated with the user id of the commenter and the team being commented on

## Pit Scouting

* Scouts shall be able to fill out a questionnaire on the team.  
  * The questionnaire changes year to year, so this part of the website should be easy to update based on the game being played.