
# CrushApp-API

CrushApp-API is a TypeScript-based AWS CDK project, demonstrating a stack with various AWS services integrated. It focuses on managing integrators, integrator groups, users, and creating reports.

# Tech stack

- Amazon CDK
- Amazon Lambda
- Amazon DynamoDB
- Amazon Cognito
- Amazon API Gateway
- TypeScript
- Node.js
- Jest

# User Endpoints:
Create User:

- Method: POST
- Endpoint: /register/{creatorID}
- Integration: Lambda Function registerUser
- Authorization: Cognito User Pool
- Functionality: Registers a new user with optional creator ID.

User Login:

- Method: POST
- Endpoint: /login
- Integration: Lambda Function userLogin
- Authorization: Cognito User Pool
- Functionality: Allows a user to login.

First Login:

- Method: POST
- Endpoint: /firstLogin/{userID}
- Integration: Lambda Function firstLogin
- Authorization: Cognito User Pool
- Functionality: Performs actions on first user login.

Get User:

- Method: GET
- Endpoint: /getUser/{userID}
- Integration: Lambda Function getUser
- Authorization: Cognito User Pool
- Functionality: Retrieves user information.

Add User to Group:

- Method: POST
- Endpoint: /group/{userID}
- Integration: Lambda Function addUserToGroup
- Authorization: Cognito User Pool
- Functionality: Adds a user to a group.

Remove User from Group:

- Method: DELETE
- Endpoint: /group/{userID}
- Integration: Lambda Function removeUserFromGroup
- Authorization: Cognito User Pool
- Functionality: Removes a user from a group.

Get Workers:

- Method: GET
- Endpoint: /getWorkers/{userID}
- Integration: Lambda Function getWorkers
- Authorization: Cognito User Pool
- Functionality: Retrieves workers associated with a user.

Edit User:

- Method: PUT
- Endpoint: /edit/{userID}
- Integration: Lambda Function editUser
- Authorization: Cognito User Pool
- Functionality: Edits user information.
# Integrator Endpoints

Integrator:

- Method: POST
- Endpoint: /integrator/{userID}
- Integration: Lambda Function integrator
- Authorization: Cognito User Pool
- Functionality: Integration functionality.

Edit Integrator:

- Method: PUT
- Endpoint: /integrator/{userID}
- Integration: Lambda Function editIntegrator
- Authorization: Cognito User Pool
- Functionality: Edits integrator information.

Get Integrators:

- Method: GET
- Endpoint: /integrator/{userID}
- Integration: Lambda Function getIntegrators
- Authorization: Cognito User Pool
- Functionality: Retrieves integrators.

Integrator Group:

- Method: POST
- Endpoint: /integratorGroup/{userID}/add
- Integration: Lambda Function createIntegratorGroup
- Authorization: Cognito User Pool
- Functionality: Adds integrator to a group.

Remove Integrator from Group:

- Method: DELETE
- Endpoint: /integratorGroup/{userID}/remove
- Integration: Lambda Function removeIntegratorFromGroup
- Authorization: Cognito User Pool
- Functionality: Removes integrator from a group.

Get Integrator Groups:

- Method: GET
- Endpoint: /integratorGroup/{userID}
- Integration: Lambda Function getIntegratorGroups
- Authorization: Cognito User Pool
- Functionality: Retrieves integrator groups.

Edit Integrator Group:

- Method: PUT
- Endpoint: /integratorGroup/{userID}
- Integration: Lambda Function editGroup
- Authorization: Cognito User Pool
- Functionality: Edits integrator group.

Get Integrators from Groups:

- Method: GET
- Endpoint: /integratorGroup/{userID}/fromGroups
- Integration: Lambda Function getIntegratorsFromGroups
- Authorization: Cognito User Pool
- Functionality: Retrieves integrators from groups.

Integrator Entry:

- Method: POST
- Endpoint: /integratorEntry/{userID}
- Integration: Lambda Function createIntegratorEntry
- Authorization: Cognito User Pool
- Functionality: Integrator entry functionality.

Create Report:

- Method: POST
- Endpoint: /report/{requesterID}
- Integration: Lambda Function createReport
- Authorization: Cognito User Pool
- Functionality: Creates a report.

Get All Reports:

- Method: GET
- Endpoint: /report/{requesterID}/all
- Integration: Lambda Function getAllReports
- Authorization: Cognito User Pool
- Functionality: Retrieves all reports.

Get Report:

- Method: GET
- Endpoint: /report/{requesterID}
- Integration: Lambda Function getReport
- Authorization: Cognito User Pool
- Functionality: Retrieves a specific report.
