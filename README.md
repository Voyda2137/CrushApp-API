
Projekt_ZPO is a TypeScript-based AWS CDK project, demonstrating a stack (ProjektZpoStack) with various AWS services integrated. It primarily focuses on managing integrator groups, users, and their interactions within an AWS environment.

Key Features:

User Management: Facilitates user registration, login, and retrieval of user details.

Integrator Management: Allows creation and management of integrators and integrator groups.

Data Handling: Provides functionalities for creating integrator entries and adding users to integrator groups.

Technology Stack:

AWS Lambda: Serverless computing to run code without provisioning or managing servers.

AWS CDK: Infrastructure as code to define cloud resources in familiar programming languages.

TypeScript: Main programming language for writing the application logic.

Getting Started:

Clone the repository.

Install dependencies: npm install

Deploy the stack: cdk deploy

API Endpoints:

User Registration and Login: Handles new user registrations and user logins.

-Register

-Login

Integrator and Group Management: For managing integrators and their groups.

-Create Integrator Group

-Add Integrator to Group

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
