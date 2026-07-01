// Constants pulled from the original Google Form. Centralised so the
// /apply form, the schema validation, and the admin filters all stay in sync.

export const SUBJECTS = ['Quran with Tajweed', 'Madrasa Tuition'] as const;

export const SYLLABUS_OPTIONS = [
  'Sunni',
  'mujahid',
  'jamaath',
  'Other'
] as const;

export const MEDIUM_OPTIONS = [
  'Fully english',
  'English + Malayalam',
  'Fully Malayalam',
  'Fully Arabic'
] as const;

export const CONNECTIVITY_OPTIONS = ['Mobile Data', 'Broadband'] as const;

export const GADGET_OPTIONS = ['Laptop', 'Smart Phone', 'Tablet', 'Digital Pen'] as const;

export const STATUS_OPTIONS = ['New', 'In Review', 'Active', 'Stopped', 'On Hold'] as const;

export const GENDERS = ['Male', 'Female', 'Other'] as const;
export const MARITAL_OPTIONS = ['Unmarried', 'Married', 'Divorced', 'Widowed'] as const;
export const YES_NO = ['Yes', 'No'] as const;

export const DECLARATION_TEXT = `By checking the box below, I hereby affirm and declare the following:

1. Regarding Personal Tuitions: I have not, nor will I in the future, approach or convince any parent or student introduced to me through the institute to engage in private tuition sessions or any other educational services outside the institute for my personal benefit. I understand that the students enrolled in the institute are its exclusive responsibility, and any attempt to divert them for personal tuition breaches professional ethics and trust.

2. Attendance and Examinations: I commit to diligently marking attendance on a daily basis and ensuring that exams are conducted after the completion of each chapter as per the institute's guidelines. Neglecting these duties compromises the educational standards and processes of the institute.

3. Responsibility towards Classes: I understand the importance of being punctual and responsible for my assigned classes. Any continuous neglect or irresponsible behavior concerning my duties can adversely affect the students' learning experience.

4. Consequences of Violation: I acknowledge that any violation of this declaration, whether it concerns personal tuitions, attendance, exams, or general responsibility towards my classes, may result in disciplinary action. This can include deductions in my salary, withholding of benefits, or the potential termination of my association with the institute.`;