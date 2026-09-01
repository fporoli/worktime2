create a new solution for managing employee and users working time:

the solution is based on following docker components:
1) an authentication docker layer based on Keycloak to authenticate the users. Here users should be able to register and reset their passwords. Google authentication should be also possible. A user can register himself as a standalone user or as an admin user for a company. When the user is an admin user, in the app he could onboard other employees in the company and define projects. He could give admin rights in the company to other users or he could assign manager role to employees.
2) a postgres database docker layer where we keep two schemas: one "auth" schema with the Keycloak users and roles, one "app" schema where we keep the data of our application.
3) a rest backend docker nest js based layer.
4) a frontend react based layer.
A normal user can only enter the daily working hours (multiple start/end time rounded to 5 minutes) and define the project being workd on.
A project could be:
- a company project
- a company subproject (no recursion needed)
- vacation / learning / on boarding / meeting ... and some other activity as specified by the admin user.
Role wise:
- an admin user could define projects for a company.
- an admin user can allocate employees to projects.
There are two sort of manager roles:
1) project manager.
2) employee manager.
