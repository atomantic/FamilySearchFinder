import fs from 'fs';
import path from 'path';
import type {
  Person,
  Database,
  GedcomPerson,
  GedcomFamily,
  GedcomFile
} from '@fsf/shared';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');

/**
 * GEDCOM 5.5.1 Parser and Generator
 * Handles import/export of GEDCOM files
 */
export const gedcomService = {
  /**
   * Export a database to GEDCOM 5.5.1 format
   */
  exportToGedcom(dbId: string): string {
    const dbPath = path.join(DATA_DIR, `db-${dbId}.json`);
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database ${dbId} not found`);
    }

    const db: Database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const lines: string[] = [];

    // Header
    lines.push('0 HEAD');
    lines.push('1 SOUR FamilySearchFinder');
    lines.push('2 VERS 1.0');
    lines.push('2 NAME FamilySearchFinder');
    lines.push('1 DEST GEDCOM');
    lines.push(`1 DATE ${formatGedcomDate(new Date())}`);
    lines.push('1 GEDC');
    lines.push('2 VERS 5.5.1');
    lines.push('2 FORM LINEAGE-LINKED');
    lines.push('1 CHAR UTF-8');

    // Create family records from parent relationships
    const families = buildFamilyRecords(db);
    const personToFamilyChild: Map<string, string[]> = new Map();
    const personToFamilySpouse: Map<string, string[]> = new Map();

    // Map persons to their family relationships
    for (const [famId, family] of Object.entries(families)) {
      if (family.husbandId) {
        const existing = personToFamilySpouse.get(family.husbandId) || [];
        existing.push(famId);
        personToFamilySpouse.set(family.husbandId, existing);
      }
      if (family.wifeId) {
        const existing = personToFamilySpouse.get(family.wifeId) || [];
        existing.push(famId);
        personToFamilySpouse.set(family.wifeId, existing);
      }
      for (const childId of family.childIds || []) {
        const existing = personToFamilyChild.get(childId) || [];
        existing.push(famId);
        personToFamilyChild.set(childId, existing);
      }
    }

    // Individual records
    for (const [personId, person] of Object.entries(db)) {
      lines.push(`0 @I${sanitizeId(personId)}@ INDI`);

      // Name
      if (person.name) {
        const nameParts = parseNameParts(person.name);
        lines.push(`1 NAME ${nameParts.given || ''} /${nameParts.surname || ''}/`);
        if (nameParts.given) lines.push(`2 GIVN ${nameParts.given}`);
        if (nameParts.surname) lines.push(`2 SURN ${nameParts.surname}`);
      }

      // Gender
      if (person.gender) {
        const sex = person.gender === 'male' ? 'M' : person.gender === 'female' ? 'F' : 'U';
        lines.push(`1 SEX ${sex}`);
      }

      // Birth
      if (person.birth) {
        lines.push('1 BIRT');
        if (person.birth.date) lines.push(`2 DATE ${person.birth.date}`);
        if (person.birth.place) lines.push(`2 PLAC ${person.birth.place}`);
      }

      // Death
      if (person.death) {
        lines.push('1 DEAT');
        if (person.death.date) lines.push(`2 DATE ${person.death.date}`);
        if (person.death.place) lines.push(`2 PLAC ${person.death.place}`);
      }

      // Burial
      if (person.burial) {
        lines.push('1 BURI');
        if (person.burial.date) lines.push(`2 DATE ${person.burial.date}`);
        if (person.burial.place) lines.push(`2 PLAC ${person.burial.place}`);
      }

      // Occupation
      if (person.occupation) {
        lines.push(`1 OCCU ${person.occupation}`);
      }

      // Note (bio)
      if (person.bio) {
        lines.push('1 NOTE');
        const bioLines = splitLongText(person.bio, 70);
        for (let i = 0; i < bioLines.length; i++) {
          if (i === 0) {
            lines.push(`2 CONT ${bioLines[i]}`);
          } else {
            lines.push(`2 CONC ${bioLines[i]}`);
          }
        }
      }

      // Family links as child
      const familyChildLinks = personToFamilyChild.get(personId) || [];
      for (const famId of familyChildLinks) {
        lines.push(`1 FAMC @${famId}@`);
      }

      // Family links as spouse
      const familySpouseLinks = personToFamilySpouse.get(personId) || [];
      for (const famId of familySpouseLinks) {
        lines.push(`1 FAMS @${famId}@`);
      }
    }

    // Family records
    for (const [famId, family] of Object.entries(families)) {
      lines.push(`0 @${famId}@ FAM`);
      if (family.husbandId) {
        lines.push(`1 HUSB @I${sanitizeId(family.husbandId)}@`);
      }
      if (family.wifeId) {
        lines.push(`1 WIFE @I${sanitizeId(family.wifeId)}@`);
      }
      for (const childId of family.childIds || []) {
        lines.push(`1 CHIL @I${sanitizeId(childId)}@`);
      }
    }

    // Trailer
    lines.push('0 TRLR');

    return lines.join('\n');
  },

  /**
   * Parse a GEDCOM file content
   */
  parseGedcom(content: string): GedcomFile {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const result: GedcomFile = {
      header: {},
      individuals: {},
      families: {}
    };

    let currentRecord: { type: string; id?: string; data: Record<string, unknown> } | null = null;
    let currentEvent: { type: string; data: Record<string, string> } | null = null;
    let currentNote = '';

    for (const line of lines) {
      const match = line.match(/^(\d+)\s+(@[^@]+@\s+)?(\S+)(.*)$/);
      if (!match) continue;

      const level = parseInt(match[1], 10);
      const idPart = match[2]?.trim();
      const tag = match[3].trim();
      const value = match[4]?.trim() || '';

      // Level 0 starts new record
      if (level === 0) {
        saveCurrentRecord(result, currentRecord);
        currentRecord = null;
        currentEvent = null;

        if (tag === 'HEAD') {
          currentRecord = { type: 'HEAD', data: {} };
        } else if (tag === 'INDI') {
          const id = idPart?.replace(/@/g, '') || '';
          currentRecord = { type: 'INDI', id, data: {} };
        } else if (tag === 'FAM') {
          const id = idPart?.replace(/@/g, '') || '';
          currentRecord = { type: 'FAM', id, data: {} };
        }
        continue;
      }

      if (!currentRecord) continue;

      // Process based on record type
      if (currentRecord.type === 'HEAD') {
        if (tag === 'SOUR') result.header.source = value;
        if (tag === 'VERS') result.header.version = value;
        if (tag === 'CHAR') result.header.charset = value;
      } else if (currentRecord.type === 'INDI') {
        if (level === 1) {
          currentEvent = null;

          if (tag === 'NAME') {
            currentRecord.data.name = value;
            // Parse given/surname from GEDCOM format: Given /Surname/
            const nameMatch = value.match(/^([^/]*)\s*\/([^/]*)\/?\s*$/);
            if (nameMatch) {
              currentRecord.data.givenName = nameMatch[1].trim();
              currentRecord.data.surname = nameMatch[2].trim();
            }
          } else if (tag === 'SEX') {
            currentRecord.data.gender = value;
          } else if (tag === 'BIRT') {
            currentEvent = { type: 'birth', data: {} };
            currentRecord.data.birth = currentEvent.data;
          } else if (tag === 'DEAT') {
            currentEvent = { type: 'death', data: {} };
            currentRecord.data.death = currentEvent.data;
          } else if (tag === 'BURI') {
            currentEvent = { type: 'burial', data: {} };
            currentRecord.data.burial = currentEvent.data;
          } else if (tag === 'FAMC') {
            const famId = value.replace(/@/g, '');
            const existing = (currentRecord.data.familyChildIds as string[]) || [];
            existing.push(famId);
            currentRecord.data.familyChildIds = existing;
          } else if (tag === 'FAMS') {
            const famId = value.replace(/@/g, '');
            const existing = (currentRecord.data.familySpouseIds as string[]) || [];
            existing.push(famId);
            currentRecord.data.familySpouseIds = existing;
          } else if (tag === 'NOTE') {
            currentNote = value;
            currentRecord.data.notes = value;
          }
        } else if (level === 2 && currentEvent) {
          if (tag === 'DATE') currentEvent.data.date = value;
          if (tag === 'PLAC') currentEvent.data.place = value;
        } else if (level === 2) {
          if (tag === 'GIVN') currentRecord.data.givenName = value;
          if (tag === 'SURN') currentRecord.data.surname = value;
          if (tag === 'CONT') currentNote += '\n' + value;
          if (tag === 'CONC') currentNote += value;
        }
      } else if (currentRecord.type === 'FAM') {
        if (tag === 'HUSB') {
          currentRecord.data.husbandId = value.replace(/@/g, '').replace(/^I/, '');
        } else if (tag === 'WIFE') {
          currentRecord.data.wifeId = value.replace(/@/g, '').replace(/^I/, '');
        } else if (tag === 'CHIL') {
          const childId = value.replace(/@/g, '').replace(/^I/, '');
          const existing = (currentRecord.data.childIds as string[]) || [];
          existing.push(childId);
          currentRecord.data.childIds = existing;
        } else if (tag === 'MARR') {
          currentEvent = { type: 'marriage', data: {} };
        } else if (level === 2 && currentEvent?.type === 'marriage') {
          if (tag === 'DATE') currentRecord.data.marriageDate = value;
          if (tag === 'PLAC') currentRecord.data.marriagePlace = value;
        }
      }
    }

    // Save last record
    saveCurrentRecord(result, currentRecord);

    return result;
  },

  /**
   * Validate GEDCOM file content
   */
  validateGedcom(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for required header
    if (!content.includes('0 HEAD')) {
      errors.push('Missing GEDCOM header (0 HEAD)');
    }

    // Check for trailer
    if (!content.includes('0 TRLR')) {
      errors.push('Missing GEDCOM trailer (0 TRLR)');
    }

    // Check for at least one individual
    if (!content.includes('INDI')) {
      errors.push('No individual records found');
    }

    // Try to parse to check for structural errors
    const parsed = this.parseGedcom(content);
    const individualCount = Object.keys(parsed.individuals).length;
    const familyCount = Object.keys(parsed.families).length;

    if (individualCount === 0) {
      errors.push('No valid individual records could be parsed');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Import GEDCOM file and create a new database
   */
  importGedcom(content: string, dbName: string): { dbId: string; personCount: number } {
    const gedcom = this.parseGedcom(content);

    // Create database from GEDCOM data
    const db: Database = {};

    // First pass: Create all persons
    for (const [gedId, gedPerson] of Object.entries(gedcom.individuals)) {
      const personId = gedId.replace(/^I/, '');
      const person = this.gedcomToPerson(gedPerson);
      db[personId] = person;
    }

    // Second pass: Resolve family relationships
    for (const family of Object.values(gedcom.families)) {
      const childIds = family.childIds || [];

      for (const childId of childIds) {
        const child = db[childId];
        if (!child) continue;

        if (family.husbandId && db[family.husbandId]) {
          child.parents[0] = family.husbandId;
        }
        if (family.wifeId && db[family.wifeId]) {
          child.parents[1] = family.wifeId;
        }
      }

      // Add children to parents
      if (family.husbandId && db[family.husbandId]) {
        db[family.husbandId].children = db[family.husbandId].children || [];
        db[family.husbandId].children.push(...childIds.filter(id => db[id]));
      }
      if (family.wifeId && db[family.wifeId]) {
        db[family.wifeId].children = db[family.wifeId].children || [];
        db[family.wifeId].children.push(...childIds.filter(id => db[id]));
      }

      // Add spouses
      if (family.husbandId && family.wifeId) {
        if (db[family.husbandId]) {
          db[family.husbandId].spouses = db[family.husbandId].spouses || [];
          if (!db[family.husbandId].spouses!.includes(family.wifeId)) {
            db[family.husbandId].spouses!.push(family.wifeId);
          }
        }
        if (db[family.wifeId]) {
          db[family.wifeId].spouses = db[family.wifeId].spouses || [];
          if (!db[family.wifeId].spouses!.includes(family.husbandId)) {
            db[family.wifeId].spouses!.push(family.husbandId);
          }
        }
      }
    }

    // Save database
    const dbId = dbName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dbPath = path.join(DATA_DIR, `db-${dbId}.json`);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    return {
      dbId,
      personCount: Object.keys(db).length
    };
  },

  /**
   * Convert a GEDCOM person to our Person format
   */
  gedcomToPerson(gedPerson: GedcomPerson): Person {
    const person: Person = {
      name: gedPerson.name || 'Unknown',
      lifespan: '',
      living: false,
      parents: [],
      children: []
    };

    // Gender
    if (gedPerson.gender) {
      person.gender = gedPerson.gender === 'M' ? 'male' :
        gedPerson.gender === 'F' ? 'female' : 'unknown';
    }

    // Birth
    if (gedPerson.birth) {
      person.birth = {
        date: gedPerson.birth.date,
        place: gedPerson.birth.place
      };
    }

    // Death
    if (gedPerson.death) {
      person.death = {
        date: gedPerson.death.date,
        place: gedPerson.death.place
      };
    }

    // Burial
    if (gedPerson.burial) {
      person.burial = {
        date: gedPerson.burial.date,
        place: gedPerson.burial.place
      };
    }

    // Compute lifespan
    const birthYear = extractYear(gedPerson.birth?.date);
    const deathYear = extractYear(gedPerson.death?.date);
    if (birthYear || deathYear) {
      person.lifespan = `${birthYear || '?'}-${deathYear || ''}`;
    }

    // Location (first available place)
    person.location = person.birth?.place || person.death?.place;

    // Notes as bio
    if (gedPerson.notes) {
      person.bio = gedPerson.notes;
    }

    return person;
  },

  /**
   * Convert a Person to GEDCOM person
   */
  personToGedcom(person: Person, id: string): GedcomPerson {
    const nameParts = parseNameParts(person.name);

    return {
      id,
      name: person.name,
      givenName: nameParts.given,
      surname: nameParts.surname,
      gender: person.gender === 'male' ? 'M' : person.gender === 'female' ? 'F' : 'U',
      birth: person.birth ? { date: person.birth.date, place: person.birth.place } : undefined,
      death: person.death ? { date: person.death.date, place: person.death.place } : undefined,
      burial: person.burial ? { date: person.burial.date, place: person.burial.place } : undefined,
      notes: person.bio
    };
  }
};

/**
 * Helper: Save current record to result
 */
function saveCurrentRecord(
  result: GedcomFile,
  record: { type: string; id?: string; data: Record<string, unknown> } | null
): void {
  if (!record || !record.id) return;

  if (record.type === 'INDI') {
    const id = record.id.replace(/^I/, '');
    result.individuals[id] = {
      id,
      name: record.data.name as string || 'Unknown',
      givenName: record.data.givenName as string,
      surname: record.data.surname as string,
      gender: record.data.gender as 'M' | 'F' | 'U',
      birth: record.data.birth as { date?: string; place?: string },
      death: record.data.death as { date?: string; place?: string },
      burial: record.data.burial as { date?: string; place?: string },
      familyChildIds: record.data.familyChildIds as string[],
      familySpouseIds: record.data.familySpouseIds as string[],
      notes: record.data.notes as string
    };
  } else if (record.type === 'FAM') {
    result.families[record.id] = {
      id: record.id,
      husbandId: record.data.husbandId as string,
      wifeId: record.data.wifeId as string,
      childIds: record.data.childIds as string[],
      marriageDate: record.data.marriageDate as string,
      marriagePlace: record.data.marriagePlace as string
    };
  }
}

/**
 * Helper: Build family records from database
 */
function buildFamilyRecords(db: Database): Record<string, GedcomFamily> {
  const families: Record<string, GedcomFamily> = {};
  const parentPairsProcessed = new Set<string>();

  for (const [personId, person] of Object.entries(db)) {
    if (person.parents.length === 0) continue;

    const fatherId = person.parents[0];
    const motherId = person.parents[1];

    // Create unique key for parent pair
    const pairKey = `${fatherId || ''}_${motherId || ''}`;
    if (!parentPairsProcessed.has(pairKey) && (fatherId || motherId)) {
      const famId = `F${Object.keys(families).length + 1}`;
      families[famId] = {
        id: famId,
        husbandId: fatherId || undefined,
        wifeId: motherId || undefined,
        childIds: []
      };
      parentPairsProcessed.add(pairKey);
    }

    // Find the family and add this person as a child
    for (const family of Object.values(families)) {
      if (family.husbandId === fatherId && family.wifeId === motherId) {
        family.childIds = family.childIds || [];
        family.childIds.push(personId);
        break;
      }
    }
  }

  return families;
}

/**
 * Helper: Format date for GEDCOM
 */
function formatGedcomDate(date: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Helper: Parse name into given/surname parts
 */
function parseNameParts(name: string): { given?: string; surname?: string } {
  if (!name) return {};

  // Try to split on last space for "Given Surname" format
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { surname: parts[0] };
  }

  return {
    given: parts.slice(0, -1).join(' '),
    surname: parts[parts.length - 1]
  };
}

/**
 * Helper: Extract year from date string
 */
function extractYear(date: string | undefined): string | undefined {
  if (!date) return undefined;

  // Handle BC dates
  const bcMatch = date.match(/(\d+)\s*BC/i);
  if (bcMatch) return `-${bcMatch[1]}`;

  // Handle regular years
  const yearMatch = date.match(/(\d{4})/);
  return yearMatch?.[1];
}

/**
 * Helper: Sanitize ID for GEDCOM
 */
function sanitizeId(id: string): string {
  return id.replace(/[^A-Za-z0-9-]/g, '_');
}

/**
 * Helper: Split long text into chunks
 */
function splitLongText(text: string, maxLength: number): string[] {
  const result: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      result.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf(' ', maxLength);
    if (breakPoint <= 0) breakPoint = maxLength;

    result.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trim();
  }

  return result;
}
