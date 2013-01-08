#Authentication Server (AS)

##Overview
The Authentication Server (AS) has a key pair with the [Identity Exchange](https://github.com/dickhardt/A2P3/tree/master/app/ix) (IX) and is trusted by the IX to authenticate the user. The [Agent](https://github.com/dickhardt/A2P3_agent) interacts with the user, and then sends components of the request from an App to the AS to encrypt and sign for the IX.

In the POC, the user authenticates and enrolls at the Setup Server and then is sent to the AS. The AS generates an Agent Request that is redirected back to Setup, that generates an IX that is redirected back to the AS that then calls the IX to get the AS Directed Identifier for the User.

The AS then has the user enroll a Personal Agent that can then be used to authenticate the user to Apps.

##Agent Enrollment

The agent is enrolled by acquiring a `code` from the AS and then calling the `/register/agent` API at the AS.

The code is acquired by scanning the QR code generated during the agent enrollment process on the AS web site, or if the AS web site is running on the mobile device, the agent may be invoked with the `/enroll` API call as such:

	a2p3.net://enroll?code=efhnjauy3kduijhdkjsdkajskjfd

Once the Agent has the code, it prompts the user for a name for the agent, ideally prefilling the name with the device name. The Agent then prompts the user for the passcode the user entered at the AS, generates a unique 128 bit identifier, converts it to a URL safe string, and then the Agent sends:
	
	passcode
	name
	code
	device

as `application/x-www-form-urlencoded` to `/register/agent`

example

```
POST /register/agent
Content-Type: application/x-www-form-urlencoded
	
passcode=1234&name=my%20iphone&code=efhnjauy3kduijhdkjsdkajskjfd&device=kiwjsyvsneysidoopSjkDeleksdd

```
If all goes well, the AS will return

```
{ result : { token : kIOiuUIUIjksddakjladlkjdas }

```

The returned `token` is used when the Agent is making calls to the Registrar.

The generated `device` parameter is saved and used in later calls to the AS.

The Agent discards the passcode and name values that it gathered from the user.

##Token Exchange

When the Agent has received an Agent Request from an App and successfully received authentication and authorization from the User, the Agent calls the AS to acquire an IX Token that it then returns to the calling App.

The Agent then sends the following data as JSON:

```
device:		#device value previously generated
sar:		#signature of Agent Request
auth:
	passcode:		#passcode provided by user if requested
	authorization:	#boolean if user authorized transaction
	
```
as `application/json` content to `/token`

example

```
POST /token
Content-Type: application/json

{ "device":"kiwjsyvsneysidoopSjkDeleksdd"
, "sar": "jhGYUbjhHhjhHhJKNkjnIJiiuIUUIjhkHBuytrtrRTtRTF"
, "auth":
	{ "passcode": "1234"
	, "authorization": true
	}
```
