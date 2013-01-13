#Health Standardized Resource Server

##Overview
The Health Standardized Resource Service (Health) 





#### /prov_number

Retrieve a user's provincial health care number.

**parameters**
- token: the RS Token

**scope**
	https://health.a2p3.net/scope/prov_number

#### /oauth

**returns**

- access_token: an OAuth access token for long term access to a Health Resource Server. Required for `/series/update` and `/series/retrieve` APIs

**parameters**

- token: the RS Token

Returns:
	access_token: An OAuth access token

#### /series/retrieve

**parameters**

- access_token: OAuth access token
- series: name of series. Only supported series currently is 'weight'

**returns**
	an array of date, value pairs

**scope** 

	https://health.a2p3.net/scope/series/weight/retrieve


#### /series/update

**parameters**

- access_token: OAuth access token
- series - name of series.  Only supported series currently is 'weight'
- data - value
- time - optional parameter to indicate what time the data is for, default is current time.

**scope** 

	https://health.a2p3.net/scope/series/weight/update
	
	