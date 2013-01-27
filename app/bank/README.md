#Bank

##Mobile Api

State information is managed in a session cookie.

#### /login/direct?json=true
Called to create an Agent Reuquest when the User already has an account.
returns

`{ "result": { "request": agentRequest } }`

#### /new/direct?json=true
Called to create an Agent Request to create a new account.
returns

`{ "result": { "request": agentRequest } }`
#### /profile
Returns the user's profile. The profile will contain much more detail after a call to create a new account

#### /agree/tos
Call this once the user has agreed to the TOS. An account will be created. 

#### /close
Deletes the currently logged in account
