/**
 * Synthetic test data. Every name, company and number is invented; nothing here comes from a real person.
 * Dates are written so that results do not depend on the current date (an explicit `now` is injected in tests).
 */

export const NOW = new Date('2026-11-06T12:00:00Z');

/* ------------------------------ English ------------------------------ */

export const JOB_EN = `Data Engineer
About us
We are a fast growing company building tools for logistics teams across the region.
Responsibilities
Build and maintain data pipelines for analytics teams.
Monitor warehouse performance and improve query speed.
Requirements
3+ years of experience in data engineering.
Strong SQL and Python skills.
Hands-on experience with Airflow and AWS.
Fluent English, written and spoken.
Bachelor's degree in computer science or a related field.
Nice to have
Kafka or dbt experience.
Benefits
Private health insurance, remote work and a learning budget.`;

export const CV_STRONG_EN = `Alex Sample
alex.sample@example.com | +1 555 010 2030
Summary
Data engineer with six years of experience building batch and streaming pipelines for logistics analytics.
Experience
Senior Data Engineer, Northwind Logistics 03/2021 - Present
- Built Airflow pipelines on AWS that load 40 million rows per day into the warehouse.
- Reduced average query time by 62% after redesigning SQL models and partitioning.
- Migrated 14 Python batch jobs to Kafka based streaming, cutting data delay from 6 hours to 5 minutes.
Data Engineer, Contoso Freight 06/2018 - 02/2021
- Wrote Python and SQL transformations used by 25 analysts in daily reporting.
- Automated 9 manual Excel reports with Airflow, saving 12 hours per week.
Education
BSc Computer Science, Example University 2014 - 2018
Skills
SQL, Python, Airflow, AWS, Kafka, dbt, Docker
Languages
English (fluent), Spanish (intermediate)`;

export const CV_WEAK_EN = `Jordan Placeholder
jordan.placeholder@example.com
Profile
Dynamic and results-driven professional. Passionate team player with strong communication skills and a proven track record. Highly motivated self-starter who thinks outside the box.
Experience
Marketing Assistant, Fabrikam Retail 2019 - 2021
- Responsible for various tasks in the marketing department.
- Helped with social media posts and assisted with events.
- Successfully completed many projects for the team.
Office Coordinator, Tailspin Services 2017 - 2019
- Worked on scheduling and involved in customer calls.
- Contributed to different activities in the office.
Education
Diploma in Business Administration, Sample College
Skills
Microsoft Office, communication, teamwork`;

export const CV_CLICHE_HEAVY_EN = `Sam Dummy
sam.dummy@example.com
Summary
Results-driven and highly motivated professional. Passionate about technology and a strong team player.
Hard-working self-starter with excellent communication skills. Dynamic professional who works well under pressure.
Experience
Data Engineer, Litware Systems 01/2020 - Present
Passionate about delivering value. Proactive and detail oriented. A fast learner and a proven track record of success.
- Built SQL and Python pipelines with Airflow on AWS for the analytics group.
Education
BSc Information Systems, Sample University 2015 - 2019
Skills
SQL, Python, Airflow, AWS`;

export const CV_MIXED_DATES_EN = `Chris Mixed
chris.mixed@example.com
Experience
Backend Developer, Adatum Corp March 2019 - 12/2021
- Maintained Python services used by 8 internal teams and reduced incidents by 30%.
Platform Engineer, Proseware Inc 2022 - 06.2024
- Operated AWS infrastructure for 12 production services with 99.9% uptime.
Analyst, Wingtip Toys 15/01/2016 - 02/2019
- Produced SQL reports for 5 regional managers every Monday.
Education
BSc Mathematics, Example University 2012 - 2016
Skills
SQL, Python, AWS`;

export const CV_SHORT = `Pat Tiny
pat.tiny@example.com
Experience
Worked somewhere.`;

/* ------------------------------ Turkish ------------------------------ */

export const JOB_TR = `Veri Mühendisi
Hakkımızda
Lojistik ekipleri için araçlar geliştiren hızlı büyüyen bir şirketiz.
Sorumluluklar
Analitik ekipler için veri boru hatları kurmak ve sürdürmek.
Aranan Nitelikler
En az 3 yıl veri mühendisliği deneyimi.
SQL ve Python bilgisi.
Airflow ve AWS deneyimi.
İyi derecede İngilizce bilgisi.
Üniversite mezunu (lisans).
Tercih sebebi
Kafka bilgisi artı olacaktır.
Yan Haklar
Özel sağlık sigortası ve uzaktan çalışma.`;

export const CV_TR = `Ayşe Örnek
ayse.ornek@example.com
Özet
Dört yıllık deneyime sahip veri mühendisi. Ekip çalışmasına yatkın, sorumluluk sahibi ve çözüm odaklı bir profesyonelim.
İş Deneyimi
Veri Mühendisi, Örnek Lojistik 02/2022 - Halen
- Airflow ile günlük 20 milyon satırlık veri yükleme süreçlerini kurdum.
- SQL sorgularını yeniden yazarak rapor süresini %45 azalttım.
- Çeşitli projelerde sorumluydum ve başarıyla tamamladım.
Junior Analist, Deneme Ticaret 07/2020 - 01/2022
- Python ile haftalık raporları otomatikleştirdim.
Eğitim
Bilgisayar Mühendisliği Lisans, Örnek Üniversitesi 2016 - 2020
Beceriler
SQL, Python, Airflow, Docker
Diller
Türkçe (anadil), İngilizce (ileri)`;

/* ------------------------------ Spanish ------------------------------ */

export const JOB_ES = `Ingeniero de Datos
Sobre nosotros
Somos una empresa en crecimiento que desarrolla herramientas para equipos de logística.
Responsabilidades
Construir y mantener pipelines de datos para los equipos de analítica.
Requisitos
Mínimo 3 años de experiencia en ingeniería de datos.
Conocimientos sólidos de SQL y Python.
Experiencia con Airflow y AWS.
Inglés avanzado.
Se valorará
Experiencia con Kafka.
Beneficios
Seguro médico privado y trabajo remoto.`;

export const CV_ES = `Lucía Ejemplo
lucia.ejemplo@example.com
Resumen
Ingeniera de datos con cuatro años de experiencia. Persona proactiva y responsable con capacidad de adaptación y trabajo en equipo.
Experiencia laboral
Ingeniera de Datos, Logística Ejemplo 03/2022 - Actualidad
- Implementé pipelines en Airflow sobre AWS que procesan 15 millones de filas por día.
- Reduje el tiempo de consulta SQL en un 40% con nuevas particiones.
- Encargada de diversas tareas y participé en varios proyectos.
Analista de Datos, Comercio Demo 06/2020 - 02/2022
- Automaticé 6 reportes semanales en Python.
Educación
Licenciatura en Ingeniería de Sistemas, Universidad Ejemplo 2015 - 2019
Habilidades
SQL, Python, Airflow, AWS, Docker
Idiomas
Español (nativo), Inglés (avanzado)`;

/* ------------------------------ edge-case fixtures ------------------------------ */

export const JOB_SENIOR_EN = `Senior Platform Engineer
Requirements
At least 8 years of experience in platform engineering.
Master's degree in engineering or a related discipline.
Strong Kubernetes, Terraform and Python skills.
Experience with Docker and AWS.
Proficiency in German is required.
Nice to have
Rust or Go experience.`;

/** Letter-spaced headings, an impossible date range, an open-ended range, short dated experience, no education block. */
export const CV_MESSY_EN = `Robin Messy
robin.messy@example.com
E X P E R I E N C E
Junior Developer, Initech Ltd 05/2022 - 03/2021
- Maintained internal Python tools used by 4 teams and fixed 30 bugs in the first quarter.
Support Engineer, Umbrella Works Jan 2023 -
- Answered 40 customer tickets per day and wrote 12 knowledge base articles for the team.
S K I L L S
Python, Docker, Excel
Languages
English (fluent)`;

/** Many experience lines and a heading, but no dates anywhere. */
export const CV_NO_DATES_EN = `Taylor Undated
taylor.undated@example.com
Experience
Backend Developer at Globex Corporation
- Built Python services that process 2 million requests per day for the billing team.
- Reduced deployment time from 40 minutes to 6 minutes by automating release steps.
- Designed SQL schemas for 12 internal reporting tools used by finance analysts.
- Wrote integration tests covering 85% of the payment module and fixed 25 defects.
- Mentored 3 new engineers and documented 14 internal runbooks for the on-call team.
Education
BSc Computer Engineering, Example University
Skills
Python, SQL, Docker, AWS, Kubernetes`;

/** A clean CV with a 12-month gap between two roles (context item, never a deduction). */
export const CV_GAP_EN = `Gap Person
gap.person@example.com
Experience
Analyst, Alpha Co 01/2015 - 12/2016
- Produced SQL reports for 5 managers every Monday and improved turnaround by 20%.
Engineer, Beta Co 01/2019 - Present
- Built Python and Airflow jobs on AWS handling 3 million rows per day for the finance team.
Education
BSc Mathematics, Example University 2010 - 2014
Skills
SQL, Python, Airflow, AWS
Languages
English (fluent)`;

/* ------------------------------ frontend regression fixtures ------------------------------ */

export const JOB_FRONTEND_EN = `Frontend Engineer
Requirements
At least 3 years of experience in frontend engineering.
Strong TypeScript and React skills.
Hands-on REST API integrations experience.
Experience working with Figma for UI design.
Proficiency with Git and GitHub.
English B1 proficiency required.
Experience with Jest for testing.
Nice to have
CI/CD pipeline experience.`;

export const CV_PROFESSIONAL_FRONTEND_EN = `Jane Professional
jane.pro@example.com | +1 555 123 4567 | github.com/janepro
Summary
Frontend Engineer with 4 years of experience building accessible web apps with React and TypeScript.
Experience
Senior Frontend Engineer, Acme Corp 01/2022 - Present
- Built responsive user interfaces using React, TypeScript and Vite, improving page load by 35%.
- Implemented REST API integrations with backend services for payment and user authentication.
- Collaborated closely with design team in Figma to implement WCAG 2.1 AA accessible component library.
- Wrote unit and integration tests using Vitest and React Testing Library, achieving 85% code coverage.
Junior Frontend Developer, Beta Startup 06/2020 - 12/2021
- Maintained web features using JavaScript and React.
- Managed version control with Git and GitHub, reviewing 50+ pull requests.
Education
BSc Computer Science, Tech University 2016 - 2020
Skills
React, TypeScript, JavaScript, HTML, CSS, REST APIs, Figma, Git, GitHub, Vite, Vitest, React Testing Library, WCAG
Languages
English B1, Turkish (Native)`;

export const CV_AMATEUR_FRONTEND_EN = `John Amateur
john.amateur@example.com | +1 555 987 6543
Summary
Junior frontend developer eager to learn and contribute to modern web applications.
Experience
Web Developer Intern, Startup X 2023 - Present
- Assisted senior engineers with building responsive user interface features using React and JavaScript.
- Connected frontend components to API endpoints for dynamic data fetching and state updates.
- Participated in weekly agile standup meetings and contributed to team retrospectives.
Intern, Alpha Co 2022
- Maintained legacy website pages and updated HTML and CSS templates for marketing campaigns.
- Assisted with bug fixes and cross browser testing across mobile and desktop devices.
Education
High School Diploma, Sample High School 2021
Skills & Tools
React, JavaScript, HTML, CSS, Git, API
Languages
English (Intermediate)`;

export const CV_NO_CONTACT_EN = `No Contact Person
Summary
Software developer with extensive professional experience in building web applications and enterprise software systems across various domains and cloud environments.
Experience
Software Engineer, Tech Corp 01/2021 - 01/2023
- Built React components and REST APIs supporting over 10,000 daily active users in production.
- Maintained legacy backend microservices written in Node.js, TypeScript and Python.
Education
BSc Computer Science, Tech University 2017 - 2021
Skills
React, JavaScript, TypeScript, Node.js, Python`;


