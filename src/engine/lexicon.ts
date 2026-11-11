import type { EducationLevel, RequirementKind } from '../types/index.ts';
import { foldText } from './text.ts';

/**
 * Skill / tool / certification lexicon used to recognise requirements in a job listing and
 * evidence in a CV. Soft skills ("communication", "teamwork") are deliberately NOT here:
 * they appear in nearly every listing and are handled by the Copy-Paste inspector instead.
 *
 * `impliedBy` lists other skill ids whose presence in a CV is partial evidence
 * (e.g. PostgreSQL in a CV is partial evidence for a "SQL" requirement).
 */

export interface LexiconEntry {
  id: string;
  label: string;
  kind: Extract<RequirementKind, 'skill' | 'certification'>;
  /** Folded terms (label + aliases). */
  terms: string[];
  impliedBy: string[];
}

type Row = [id: string, label: string, aliases: string[], impliedBy?: string[], kind?: 'skill' | 'certification'];

const ROWS: Row[] = [
  // Languages
  ['python', 'Python', ['python3'], ['django', 'flask', 'fastapi', 'pandas', 'numpy']],
  ['javascript', 'JavaScript', ['js', 'ecmascript', 'es6'], ['typescript']],
  ['typescript', 'TypeScript', []],
  ['java', 'Java', [], ['spring']],
  ['csharp', 'C#', ['c sharp', 'csharp'], ['dotnet']],
  ['cpp', 'C++', ['cpp']],
  ['go', 'Go', ['golang', 'go language']],
  ['rust', 'Rust', []],
  ['php', 'PHP', [], ['laravel']],
  ['ruby', 'Ruby', [], ['rails']],
  ['swift', 'Swift', []],
  ['kotlin', 'Kotlin', []],
  ['scala', 'Scala', []],
  ['r', 'R', ['r programming', 'r language']],
  ['matlab', 'MATLAB', []],
  ['bash', 'Bash', ['shell scripting', 'bash scripting']],
  // Web / app frameworks
  ['react', 'React', ['reactjs', 'react.js']],
  ['angular', 'Angular', ['angularjs']],
  ['vue', 'Vue', ['vue.js', 'vuejs']],
  ['nextjs', 'Next.js', ['next.js', 'nextjs']],
  ['nodejs', 'Node.js', ['node.js', 'nodejs']],
  ['django', 'Django', []],
  ['flask', 'Flask', []],
  ['fastapi', 'FastAPI', []],
  ['spring', 'Spring', ['spring boot', 'springboot']],
  ['dotnet', '.NET', ['.net', 'asp.net', 'dotnet', 'dot net']],
  ['laravel', 'Laravel', []],
  ['rails', 'Ruby on Rails', ['rails', 'ruby on rails']],
  ['flutter', 'Flutter', []],
  ['reactnative', 'React Native', ['react native']],
  ['html', 'HTML', ['html5']],
  ['css', 'CSS', ['css3', 'sass', 'scss']],
  ['tailwind', 'Tailwind CSS', ['tailwind', 'tailwindcss']],
  ['api', 'API', ['apis', 'web api', 'web apis', 'api endpoints'], ['restapi', 'graphql']],
  ['restapi', 'REST APIs', ['rest api', 'rest apis', 'restful', 'restful api', 'api rest', 'rest api integrations', 'restful apis', 'rest-api'], ['api']],
  ['graphql', 'GraphQL', []],
  ['microservices', 'Microservices', ['microservice', 'mikroservis', 'mikroservisler', 'microservicios']],
  // Data
  ['sql', 'SQL', ['t-sql', 'structured query language'], ['postgresql', 'mysql', 'sqlserver', 'oracledb', 'sqlite']],
  ['postgresql', 'PostgreSQL', ['postgres']],
  ['mysql', 'MySQL', ['mariadb']],
  ['sqlserver', 'SQL Server', ['sql server', 'mssql', 'ms sql']],
  ['oracledb', 'Oracle Database', ['oracle database', 'pl/sql', 'plsql']],
  ['sqlite', 'SQLite', []],
  ['mongodb', 'MongoDB', ['mongo']],
  ['redis', 'Redis', []],
  ['elasticsearch', 'Elasticsearch', ['elastic search', 'opensearch']],
  ['snowflake', 'Snowflake', []],
  ['bigquery', 'BigQuery', ['big query']],
  ['airflow', 'Airflow', ['apache airflow']],
  ['spark', 'Spark', ['apache spark', 'pyspark']],
  ['kafka', 'Kafka', ['apache kafka']],
  ['dbt', 'dbt', []],
  ['hadoop', 'Hadoop', []],
  ['etl', 'ETL', ['elt', 'data pipelines', 'data pipeline', 'veri boru hatlari', 'pipelines de datos']],
  ['datawarehouse', 'Data Warehouse', ['data warehouse', 'veri ambari', 'almacen de datos', 'data warehousing']],
  ['pandas', 'pandas', []],
  ['numpy', 'NumPy', ['numpy']],
  ['dataanalysis', 'Data Analysis', ['data analysis', 'data analytics', 'veri analizi', 'analisis de datos', 'analitica de datos'], ['pandas', 'sql', 'powerbi', 'tableau']],
  ['statistics', 'Statistics', ['statistical analysis', 'istatistik', 'istatistiksel analiz', 'estadistica', 'analisis estadistico']],
  // ML
  ['ml', 'Machine Learning', ['machine learning', 'makine ogrenmesi', 'makine ogrenimi', 'aprendizaje automatico', 'aprendizaje de maquina'], ['scikit', 'tensorflow', 'pytorch']],
  ['scikit', 'scikit-learn', ['sklearn', 'scikit learn']],
  ['tensorflow', 'TensorFlow', []],
  ['pytorch', 'PyTorch', []],
  ['deeplearning', 'Deep Learning', ['deep learning', 'derin ogrenme', 'aprendizaje profundo'], ['tensorflow', 'pytorch']],
  ['nlp', 'NLP', ['natural language processing', 'dogal dil isleme', 'procesamiento de lenguaje natural']],
  // BI & office
  ['powerbi', 'Power BI', ['power bi', 'powerbi']],
  ['tableau', 'Tableau', []],
  ['looker', 'Looker', ['looker studio', 'data studio']],
  ['excel', 'Excel', ['microsoft excel', 'ms excel', 'advanced excel', 'excel avanzado', 'ileri excel']],
  ['googlesheets', 'Google Sheets', ['google sheets', 'google sheet']],
  // Cloud / devops
  ['aws', 'AWS', ['amazon web services']],
  ['azure', 'Azure', ['microsoft azure']],
  ['gcp', 'Google Cloud', ['gcp', 'google cloud', 'google cloud platform']],
  ['docker', 'Docker', []],
  ['kubernetes', 'Kubernetes', ['k8s']],
  ['terraform', 'Terraform', []],
  ['ansible', 'Ansible', []],
  ['jenkins', 'Jenkins', []],
  ['cicd', 'CI/CD', ['ci/cd', 'ci cd', 'continuous integration', 'continuous delivery', 'github actions', 'gitlab ci']],
  ['git', 'Git', [], ['github', 'gitlab']],
  ['github', 'GitHub', ['github.com']],
  ['linux', 'Linux', ['unix']],
  // Process / tools
  ['agile', 'Agile', ['cevik metodolojiler', 'cevik metodoloji', 'cevik yontemler', 'agil', 'metodologias agiles', 'metodologia agil', 'agile methodologies'], ['scrum', 'kanban']],
  ['scrum', 'Scrum', []],
  ['kanban', 'Kanban', []],
  ['jira', 'Jira', []],
  ['confluence', 'Confluence', []],
  ['testing', 'Software Testing', ['unit testing', 'test automation', 'test otomasyonu', 'pruebas automatizadas', 'pruebas unitarias', 'birim test'], ['jest', 'vitest', 'reacttestinglibrary', 'selenium', 'cypress']],
  ['jest', 'Jest', [], ['vitest', 'reacttestinglibrary']],
  ['vitest', 'Vitest', []],
  ['reacttestinglibrary', 'React Testing Library', ['testing library', 'react-testing-library', 'rtl']],
  ['vite', 'Vite', ['vitejs', 'vite.js']],
  ['wcag', 'WCAG', ['wcag 2.1', 'wcag 2.0', 'wcag 2.2', 'web content accessibility guidelines', 'accessibility', 'a11y']],
  ['selenium', 'Selenium', []],
  ['cypress', 'Cypress', []],
  // Design
  ['figma', 'Figma', []],
  ['photoshop', 'Photoshop', ['adobe photoshop']],
  ['illustrator', 'Illustrator', ['adobe illustrator']],
  ['uiux', 'UI/UX', ['ui/ux', 'ux design', 'ui design', 'ux/ui', 'kullanici deneyimi tasarimi', 'diseno ux']],
  // Marketing / sales
  ['seo', 'SEO', ['search engine optimization']],
  ['sem', 'Google Ads', ['google ads', 'adwords', 'sem']],
  ['googleanalytics', 'Google Analytics', ['google analytics', 'ga4']],
  ['socialmedia', 'Social Media', ['social media', 'sosyal medya', 'redes sociales']],
  ['contentmarketing', 'Content Marketing', ['content marketing', 'icerik pazarlama', 'icerik pazarlamasi', 'marketing de contenidos']],
  ['emailmarketing', 'Email Marketing', ['email marketing', 'e-mail marketing', 'e-posta pazarlama', 'email pazarlama', 'marketing por correo']],
  ['copywriting', 'Copywriting', ['icerik yazarligi', 'redaccion publicitaria']],
  ['hubspot', 'HubSpot', []],
  ['salesforce', 'Salesforce', []],
  ['crm', 'CRM', ['customer relationship management', 'musteri iliskileri yonetimi'], ['salesforce', 'hubspot']],
  ['sales', 'Sales', ['satis', 'ventas', 'business development']],
  ['negotiation', 'Negotiation', ['muzakere', 'negociacion', 'pazarlik']],
  ['customerservice', 'Customer Service', ['customer support', 'musteri hizmetleri', 'musteri destek', 'atencion al cliente', 'servicio al cliente']],
  // Business / finance / ops
  ['projectmanagement', 'Project Management', ['project management', 'proje yonetimi', 'gestion de proyectos', 'administracion de proyectos'], ['pmp']],
  ['productmanagement', 'Product Management', ['product management', 'urun yonetimi', 'gestion de producto']],
  ['stakeholders', 'Stakeholder Management', ['stakeholder management', 'stakeholder', 'paydas yonetimi', 'gestion de stakeholders', 'partes interesadas']],
  ['budgeting', 'Budget Management', ['budgeting', 'budget management', 'butce yonetimi', 'butce', 'gestion de presupuestos', 'presupuestos']],
  ['financialanalysis', 'Financial Analysis', ['financial analysis', 'finansal analiz', 'analisis financiero']],
  ['accounting', 'Accounting', ['muhasebe', 'contabilidad']],
  ['sap', 'SAP', []],
  ['erp', 'ERP', ['enterprise resource planning'], ['sap']],
  ['leadership', 'Leadership', ['team leadership', 'liderlik', 'liderazgo', 'takim liderligi']],
  ['hr', 'Human Resources', ['human resources', 'insan kaynaklari', 'recursos humanos']],
  ['recruiting', 'Recruiting', ['recruitment', 'talent acquisition', 'ise alim', 'reclutamiento', 'seleccion de personal']],
  ['autocad', 'AutoCAD', ['auto cad']],
  ['solidworks', 'SolidWorks', ['solid works']],
  // Certifications
  ['pmp', 'PMP', ['project management professional'], [], 'certification'],
  ['itil', 'ITIL', [], [], 'certification'],
  ['sixsigma', 'Six Sigma', ['six sigma', 'lean six sigma'], [], 'certification'],
  ['cissp', 'CISSP', [], [], 'certification'],
  ['cfa', 'CFA', ['chartered financial analyst'], [], 'certification'],
  ['cpa', 'CPA', ['certified public accountant'], [], 'certification'],
  ['psm', 'Scrum Master Certification', ['psm', 'csm', 'certified scrum master', 'professional scrum master'], [], 'certification'],
];

/** Labels that are ordinary words/letters ("R", "Go"): only their longer aliases are searched. */
const BARE_LABEL_EXCLUDED = new Set(['r', 'go']);

export const LEXICON: LexiconEntry[] = ROWS.map(([id, label, aliases, impliedBy = [], kind = 'skill']) => {
  const folded = aliases.map(foldText);
  const terms = BARE_LABEL_EXCLUDED.has(id) ? folded : [foldText(label), ...folded];
  return { id, label, kind, terms: Array.from(new Set(terms)), impliedBy };
});

/**
 * Broad concepts (as opposed to named tools). When one of these appears only in a "Responsibilities"
 * sentence without an explicit requirement cue, it describes the job, not a candidate requirement,
 * so it is not turned into a requirement ("build data pipelines" must not demand the word "ETL").
 */
export const CONCEPT_IDS: ReadonlySet<string> = new Set([
  'etl', 'datawarehouse', 'dataanalysis', 'statistics', 'microservices', 'api', 'restapi', 'testing', 'projectmanagement',
  'productmanagement', 'stakeholders', 'budgeting', 'financialanalysis', 'accounting', 'leadership', 'hr', 'recruiting',
  'sales', 'negotiation', 'customerservice', 'socialmedia', 'contentmarketing', 'emailmarketing', 'copywriting', 'uiux',
  'agile', 'cicd', 'deeplearning', 'ml', 'nlp',
]);

export const LEXICON_BY_ID: ReadonlyMap<string, LexiconEntry> = new Map(LEXICON.map((e) => [e.id, e]));

/* ------------------------------------------------------------------ */
/* Spoken languages                                                    */
/* ------------------------------------------------------------------ */

export interface SpokenLanguage {
  id: string;
  label: string;
  terms: string[];
}

const LANG_ROWS: Array<[string, string, string[]]> = [
  ['english', 'English', ['english', 'ingilizce', 'ingles']],
  ['turkish', 'Turkish', ['turkish', 'turkce', 'turco']],
  ['spanish', 'Spanish', ['spanish', 'ispanyolca', 'espanol', 'castellano']],
  ['german', 'German', ['german', 'almanca', 'aleman', 'deutsch']],
  ['french', 'French', ['french', 'fransizca', 'frances', 'francais']],
  ['italian', 'Italian', ['italian', 'italyanca', 'italiano']],
  ['portuguese', 'Portuguese', ['portuguese', 'portekizce', 'portugues']],
  ['arabic', 'Arabic', ['arabic', 'arapca', 'arabe']],
  ['russian', 'Russian', ['russian', 'rusca', 'ruso']],
  ['chinese', 'Chinese', ['chinese', 'cince', 'chino', 'mandarin']],
  ['japanese', 'Japanese', ['japanese', 'japonca', 'japones']],
];

export const SPOKEN_LANGUAGES: SpokenLanguage[] = LANG_ROWS.map(([id, label, terms]) => ({ id, label, terms: terms.map(foldText) }));

/** Words that signal a language is being REQUIRED / assessed (not just mentioned in passing). */
export const LANGUAGE_CONTEXT =
  /(fluent|fluency|proficien|command|knowledge|excellent|good|advanced|intermediate|native|bilingual|speaking|written|spoken|level|b1|b2|c1|c2|akici|ileri|orta|anadil|konusma|yazma|seviye|bilgisi|bilen|hakim|iyi|yeterli|mukemmel|buen|excelente|conocimiento|fluido|nivel|avanzado|intermedio|hablado|escrito|dominio|bilingue|idioma|language|dil\b)/;

/* ------------------------------------------------------------------ */
/* Education                                                           */
/* ------------------------------------------------------------------ */

export const EDUCATION_TERMS: Record<EducationLevel, string[]> = {
  phd: ['phd', 'ph.d', 'doctorate', 'doktora', 'doctorado'],
  master: ['master degree', "master's", 'masters degree', 'master of', 'master in', 'msc', 'm.sc', 'mba', 'yuksek lisans', 'maestria', 'posgrado', 'postgrado'],
  bachelor: ['bachelor', "bachelor's", 'bachelors', 'bsc', 'b.sc', 'undergraduate', 'university degree', 'degree in', 'lisans', 'universite mezunu', 'bolumu mezunu', 'licenciatura', 'grado universitario', 'titulo universitario', 'egresado'],
  highschool: ['high school', 'lise', 'bachillerato', 'secundaria'],
};

/** Words that evidence higher education in a CV even without naming the degree level. */
export const UNIVERSITY_WORDS = ['university', 'universite', 'universidad', 'college', 'instituto', 'faculty', 'fakulte', 'facultad', 'politecnico', 'academy'];

export const EDUCATION_RANK: Record<EducationLevel, number> = { highschool: 1, bachelor: 2, master: 3, phd: 4 };
