import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-errors';
import {
  Course,
  CourseCategory,
  HeroSlide,
  WhyChooseUsItem,
  ServiceItem,
  ProjectItem,
  TeamMember,
  ResourceItem,
  BlogPost,
  SiteSettings,
  Enquiry
} from './types';
import {
  INITIAL_COURSES,
  INITIAL_CATEGORIES,
  INITIAL_HERO_SLIDES,
  INITIAL_WHY_CHOOSE_US,
  INITIAL_SERVICES,
  INITIAL_PROJECTS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_RESOURCES,
  INITIAL_BLOG_POSTS,
  INITIAL_SITE_SETTINGS,
  INITIAL_ENQUIRIES
} from './seed-data';

/**
 * Recursively removes keys with undefined values to prevent Firestore
 * "Function setDoc() called with invalid data. Unsupported field value: undefined" errors.
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = sanitizeForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Wraps a Firestore query in a 2500ms race timeout to guarantee
 * instantaneous response and eliminate page stalls even on slow/offline connections.
 */
function fetchWithTimeout<T>(fetchPromise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    fetchPromise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore request timed out')), timeoutMs)
    )
  ]);
}

// ==================== SEED / BOOTSTRAP ====================

export async function seedInitialDatabaseIfEmpty(): Promise<{ seeded: boolean; message: string }> {
  try {
    const coursesSnapshot = await getDocs(collection(db, 'courses'));
    if (!coursesSnapshot.empty) {
      return { seeded: false, message: 'Database already has records.' };
    }

    const batch = writeBatch(db);

    // Seed Courses
    INITIAL_COURSES.forEach((course, idx) => {
      const docRef = doc(collection(db, 'courses'));
      batch.set(docRef, { ...course, id: docRef.id });
    });

    // Seed Categories
    INITIAL_CATEGORIES.forEach((cat) => {
      const docRef = doc(collection(db, 'courseCategories'));
      batch.set(docRef, { ...cat, id: docRef.id });
    });

    // Seed Hero Slides
    INITIAL_HERO_SLIDES.forEach((slide) => {
      const docRef = doc(collection(db, 'heroSlides'));
      batch.set(docRef, { ...slide, id: docRef.id });
    });

    // Seed Why Choose Us
    INITIAL_WHY_CHOOSE_US.forEach((item) => {
      const docRef = doc(collection(db, 'whyChooseUs'));
      batch.set(docRef, { ...item, id: docRef.id });
    });

    // Seed Services
    INITIAL_SERVICES.forEach((service) => {
      const docRef = doc(collection(db, 'services'));
      batch.set(docRef, { ...service, id: docRef.id });
    });

    // Seed Projects
    INITIAL_PROJECTS.forEach((proj) => {
      const docRef = doc(collection(db, 'projects'));
      batch.set(docRef, { ...proj, id: docRef.id });
    });

    // Seed Team Members
    INITIAL_TEAM_MEMBERS.forEach((member) => {
      const docRef = doc(collection(db, 'teamMembers'));
      batch.set(docRef, { ...member, id: docRef.id });
    });

    // Seed Resources
    INITIAL_RESOURCES.forEach((res) => {
      const docRef = doc(collection(db, 'resources'));
      batch.set(docRef, { ...res, id: docRef.id });
    });

    // Seed Blog Posts
    INITIAL_BLOG_POSTS.forEach((post) => {
      const docRef = doc(collection(db, 'blogPosts'));
      batch.set(docRef, { ...post, id: docRef.id });
    });

    // Seed Settings
    const settingsRef = doc(db, 'siteSettings', 'general');
    batch.set(settingsRef, INITIAL_SITE_SETTINGS);

    await batch.commit();
    return { seeded: true, message: 'All Navioraa initial database collections seeded successfully.' };
  } catch (error) {
    console.error('Seed error:', error);
    return { seeded: false, message: error instanceof Error ? error.message : 'Failed to seed database' };
  }
}

// ==================== ENTITY DELETION PERSISTENCE ====================

function getDeletedEntityIds(entityKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(`navioraa_deleted_${entityKey}_ids`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

function recordDeletedEntityId(entityKey: string, id: string): void {
  try {
    const set = getDeletedEntityIds(entityKey);
    set.add(id);
    localStorage.setItem(`navioraa_deleted_${entityKey}_ids`, JSON.stringify(Array.from(set)));
  } catch {}
}

// ==================== HERO SLIDES ====================

export async function getHeroSlides(publishedOnly = true): Promise<HeroSlide[]> {
  const deletedIds = getDeletedEntityIds('heroSlides');
  try {
    const colRef = collection(db, 'heroSlides');
    const q = publishedOnly 
      ? query(colRef, where('published', '==', true))
      : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = publishedOnly 
        ? INITIAL_HERO_SLIDES.filter(s => s.published !== false)
        : INITIAL_HERO_SLIDES;
      return list.map((s, i) => ({ ...s, id: `seed-slide-${i}` })).filter(s => !deletedIds.has(s.id));
    }
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as HeroSlide)).filter(s => !deletedIds.has(s.id));
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (error) {
    console.warn('Falling back to local hero slides:', error);
    const list = publishedOnly 
      ? INITIAL_HERO_SLIDES.filter(s => s.published !== false)
      : INITIAL_HERO_SLIDES;
    return list.map((s, i) => ({ ...s, id: `seed-slide-${i}` })).filter(s => !deletedIds.has(s.id));
  }
}

export async function saveHeroSlide(slide: Partial<HeroSlide> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'heroSlides');
  const docRef = slide.id ? doc(colRef, slide.id) : doc(colRef);
  const now = new Date().toISOString();
  const data = sanitizeForFirestore({
    ...slide,
    id: docRef.id,
    displayOrder: slide.displayOrder ?? 1,
    published: slide.published ?? true,
    updatedAt: now,
    createdAt: slide.createdAt || now,
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `heroSlides/${docRef.id}`);
  }
}

export async function deleteHeroSlide(id: string): Promise<void> {
  recordDeletedEntityId('heroSlides', id);
  try {
    await deleteDoc(doc(db, 'heroSlides', id));
  } catch (error) {
    console.warn('Firestore delete heroSlide notice:', error);
  }
}

// ==================== COURSES ====================

export async function getCourses(publishedOnly = true): Promise<Course[]> {
  const deletedIds = getDeletedEntityIds('courses');
  try {
    const colRef = collection(db, 'courses');
    const q = publishedOnly 
      ? query(colRef, where('published', '==', true))
      : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = publishedOnly 
        ? INITIAL_COURSES.filter(c => c.published !== false)
        : INITIAL_COURSES;
      return list.map((c, i) => ({ ...c, id: `seed-course-${i}` })).filter(c => !deletedIds.has(c.id));
    }
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as Course)).filter(c => !deletedIds.has(c.id));
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (error) {
    console.warn('Falling back to initial courses:', error);
    const list = publishedOnly 
      ? INITIAL_COURSES.filter(c => c.published !== false)
      : INITIAL_COURSES;
    return list.map((c, i) => ({ ...c, id: `seed-course-${i}` })).filter(c => !deletedIds.has(c.id));
  }
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const deletedIds = getDeletedEntityIds('courses');
  try {
    const q = query(collection(db, 'courses'), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      if (deletedIds.has(d.id)) return null;
      return { ...d.data(), id: d.id } as Course;
    }
    const fallback = INITIAL_COURSES.find(c => c.slug === slug);
    if (fallback && deletedIds.has('seed-' + slug)) return null;
    return fallback ? { ...fallback, id: 'seed-' + slug } : null;
  } catch (error) {
    console.warn('Error fetching course by slug:', error);
    const fallback = INITIAL_COURSES.find(c => c.slug === slug);
    if (fallback && deletedIds.has('seed-' + slug)) return null;
    return fallback ? { ...fallback, id: 'seed-' + slug } : null;
  }
}

export async function saveCourse(course: Partial<Course> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'courses');
  const docRef = course.id ? doc(colRef, course.id) : doc(colRef);
  const now = new Date().toISOString();
  const data = sanitizeForFirestore({
    ...course,
    id: docRef.id,
    displayOrder: course.displayOrder ?? 1,
    published: course.published ?? true,
    updatedAt: now,
    createdAt: course.createdAt || now,
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `courses/${docRef.id}`);
  }
}

export async function deleteCourse(id: string): Promise<void> {
  recordDeletedEntityId('courses', id);
  try {
    await deleteDoc(doc(db, 'courses', id));
  } catch (error) {
    console.warn('Firestore delete course notice:', error);
  }
}

// ==================== COURSE CATEGORIES ====================

export async function getCategories(activeOnly = true): Promise<CourseCategory[]> {
  const deletedIds = getDeletedEntityIds('courseCategories');
  try {
    const colRef = collection(db, 'courseCategories');
    const q = activeOnly ? query(colRef, where('active', '==', true)) : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = activeOnly 
        ? INITIAL_CATEGORIES.filter(c => c.active !== false)
        : INITIAL_CATEGORIES;
      return list.map((c, i) => ({ ...c, id: `seed-cat-${i}` })).filter(c => !deletedIds.has(c.id));
    }
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as CourseCategory)).filter(c => !deletedIds.has(c.id));
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (error) {
    console.warn('Fallback to initial categories:', error);
    const list = activeOnly 
      ? INITIAL_CATEGORIES.filter(c => c.active !== false)
      : INITIAL_CATEGORIES;
    return list.map((c, i) => ({ ...c, id: `seed-cat-${i}` })).filter(c => !deletedIds.has(c.id));
  }
}

export async function saveCategory(category: Partial<CourseCategory> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'courseCategories');
  const docRef = category.id ? doc(colRef, category.id) : doc(colRef);
  const data = sanitizeForFirestore({
    ...category,
    id: docRef.id,
    active: category.active ?? true,
    createdAt: category.createdAt || new Date().toISOString(),
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `courseCategories/${docRef.id}`);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  recordDeletedEntityId('courseCategories', id);
  try {
    await deleteDoc(doc(db, 'courseCategories', id));
  } catch (error) {
    console.warn('Firestore delete category notice:', error);
  }
}

// ==================== WHY CHOOSE US ====================

export async function getWhyChooseUs(publishedOnly = true): Promise<WhyChooseUsItem[]> {
  const deletedIds = getDeletedEntityIds('whyChooseUs');
  try {
    const colRef = collection(db, 'whyChooseUs');
    const q = publishedOnly ? query(colRef, where('published', '==', true)) : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = publishedOnly 
        ? INITIAL_WHY_CHOOSE_US.filter(w => w.published !== false)
        : INITIAL_WHY_CHOOSE_US;
      return list.map((item, i) => ({ ...item, id: `seed-why-${i}` })).filter(w => !deletedIds.has(w.id));
    }
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as WhyChooseUsItem)).filter(w => !deletedIds.has(w.id));
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (error) {
    const list = publishedOnly 
      ? INITIAL_WHY_CHOOSE_US.filter(w => w.published !== false)
      : INITIAL_WHY_CHOOSE_US;
    return list.map((item, i) => ({ ...item, id: `seed-why-${i}` })).filter(w => !deletedIds.has(w.id));
  }
}

export async function saveWhyChooseUs(item: Partial<WhyChooseUsItem> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'whyChooseUs');
  const docRef = item.id ? doc(colRef, item.id) : doc(colRef);
  const data = sanitizeForFirestore({
    ...item,
    id: docRef.id,
    displayOrder: item.displayOrder ?? 1,
    published: item.published ?? true,
    createdAt: item.createdAt || new Date().toISOString(),
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `whyChooseUs/${docRef.id}`);
  }
}

export async function deleteWhyChooseUs(id: string): Promise<void> {
  recordDeletedEntityId('whyChooseUs', id);
  try {
    await deleteDoc(doc(db, 'whyChooseUs', id));
  } catch (error) {
    console.warn('Firestore delete whyChooseUs notice:', error);
  }
}

// ==================== SERVICES ====================

export async function getServices(publishedOnly = true): Promise<ServiceItem[]> {
  const deletedIds = getDeletedEntityIds('services');
  try {
    const colRef = collection(db, 'services');
    const q = publishedOnly ? query(colRef, where('published', '==', true)) : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = publishedOnly 
        ? INITIAL_SERVICES.filter(s => s.published !== false)
        : INITIAL_SERVICES;
      return list.map((s, i) => ({ ...s, id: `seed-serv-${i}` })).filter(s => !deletedIds.has(s.id));
    }
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as ServiceItem)).filter(s => !deletedIds.has(s.id));
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (error) {
    const list = publishedOnly 
      ? INITIAL_SERVICES.filter(s => s.published !== false)
      : INITIAL_SERVICES;
    return list.map((s, i) => ({ ...s, id: `seed-serv-${i}` })).filter(s => !deletedIds.has(s.id));
  }
}

export async function saveService(service: Partial<ServiceItem> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'services');
  const docRef = service.id ? doc(colRef, service.id) : doc(colRef);
  const now = new Date().toISOString();
  const data = sanitizeForFirestore({
    ...service,
    id: docRef.id,
    displayOrder: service.displayOrder ?? 1,
    published: service.published ?? true,
    updatedAt: now,
    createdAt: service.createdAt || now,
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `services/${docRef.id}`);
  }
}

export async function deleteService(id: string): Promise<void> {
  recordDeletedEntityId('services', id);
  try {
    await deleteDoc(doc(db, 'services', id));
  } catch (error) {
    console.warn('Firestore delete service notice:', error);
  }
}

// ==================== PROJECTS ====================

export async function getProjects(publishedOnly = true): Promise<ProjectItem[]> {
  const deletedIds = getDeletedEntityIds('projects');
  try {
    const colRef = collection(db, 'projects');
    const q = publishedOnly ? query(colRef, where('published', '==', true)) : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = publishedOnly 
        ? INITIAL_PROJECTS.filter(p => p.published !== false)
        : INITIAL_PROJECTS;
      return list.map((p, i) => ({ ...p, id: `seed-proj-${i}` })).filter(p => !deletedIds.has(p.id));
    }
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as ProjectItem)).filter(p => !deletedIds.has(p.id));
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (error) {
    const list = publishedOnly 
      ? INITIAL_PROJECTS.filter(p => p.published !== false)
      : INITIAL_PROJECTS;
    return list.map((p, i) => ({ ...p, id: `seed-proj-${i}` })).filter(p => !deletedIds.has(p.id));
  }
}

export async function saveProject(project: Partial<ProjectItem> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'projects');
  const docRef = project.id ? doc(colRef, project.id) : doc(colRef);
  const now = new Date().toISOString();
  const data = sanitizeForFirestore({
    ...project,
    id: docRef.id,
    displayOrder: project.displayOrder ?? 1,
    published: project.published ?? true,
    updatedAt: now,
    createdAt: project.createdAt || now,
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `projects/${docRef.id}`);
  }
}

export async function deleteProject(id: string): Promise<void> {
  recordDeletedEntityId('projects', id);
  try {
    await deleteDoc(doc(db, 'projects', id));
  } catch (error) {
    console.warn('Firestore delete project notice:', error);
  }
}

// ==================== TEAM MEMBERS ====================

export async function getTeamMembers(publishedOnly = true): Promise<TeamMember[]> {
  const deletedIds = getDeletedEntityIds('teamMembers');
  try {
    const colRef = collection(db, 'teamMembers');
    const q = publishedOnly ? query(colRef, where('published', '==', true)) : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = publishedOnly 
        ? INITIAL_TEAM_MEMBERS.filter(m => m.published !== false)
        : INITIAL_TEAM_MEMBERS;
      return list.map((m, i) => ({ ...m, id: `seed-team-${i}` })).filter(m => !deletedIds.has(m.id));
    }
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as TeamMember)).filter(m => !deletedIds.has(m.id));
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    const list = publishedOnly 
      ? INITIAL_TEAM_MEMBERS.filter(m => m.published !== false)
      : INITIAL_TEAM_MEMBERS;
    return list.map((m, i) => ({ ...m, id: `seed-team-${i}` })).filter(m => !deletedIds.has(m.id));
  }
}

export async function saveTeamMember(member: Partial<TeamMember> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'teamMembers');
  const docRef = member.id ? doc(colRef, member.id) : doc(colRef);
  const now = new Date().toISOString();
  const data = sanitizeForFirestore({
    ...member,
    id: docRef.id,
    order: member.order ?? 1,
    published: member.published ?? true,
    updatedAt: now,
    createdAt: member.createdAt || now,
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `teamMembers/${docRef.id}`);
  }
}

export async function deleteTeamMember(id: string): Promise<void> {
  recordDeletedEntityId('teamMembers', id);
  try {
    await deleteDoc(doc(db, 'teamMembers', id));
  } catch (error) {
    console.warn('Firestore delete teamMember notice:', error);
  }
}

// ==================== RESOURCES ====================

export async function getResources(publishedOnly = true): Promise<ResourceItem[]> {
  const deletedIds = getDeletedEntityIds('resources');
  try {
    const colRef = collection(db, 'resources');
    const q = publishedOnly ? query(colRef, where('published', '==', true)) : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = publishedOnly 
        ? INITIAL_RESOURCES.filter(r => r.published !== false)
        : INITIAL_RESOURCES;
      return list.map((r, i) => ({ ...r, id: `seed-res-${i}` })).filter(r => !deletedIds.has(r.id));
    }
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id } as ResourceItem)).filter(r => !deletedIds.has(r.id));
    return items.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  } catch (error) {
    const list = publishedOnly 
      ? INITIAL_RESOURCES.filter(r => r.published !== false)
      : INITIAL_RESOURCES;
    return list.map((r, i) => ({ ...r, id: `seed-res-${i}` })).filter(r => !deletedIds.has(r.id));
  }
}

export async function saveResource(res: Partial<ResourceItem> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'resources');
  const docRef = res.id ? doc(colRef, res.id) : doc(colRef);
  const data = sanitizeForFirestore({
    ...res,
    id: docRef.id,
    displayOrder: res.displayOrder ?? 1,
    published: res.published ?? true,
    createdAt: res.createdAt || new Date().toISOString(),
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `resources/${docRef.id}`);
  }
}

export async function deleteResource(id: string): Promise<void> {
  recordDeletedEntityId('resources', id);
  try {
    await deleteDoc(doc(db, 'resources', id));
  } catch (error) {
    console.warn('Firestore delete resource notice:', error);
  }
}

// ==================== BLOG POSTS ====================

export async function getBlogPosts(publishedOnly = true): Promise<BlogPost[]> {
  const deletedIds = getDeletedEntityIds('blogPosts');
  try {
    const colRef = collection(db, 'blogPosts');
    const q = publishedOnly ? query(colRef, where('published', '==', true)) : colRef;
    const snap = await fetchWithTimeout(getDocs(q), 2000);
    if (snap.empty) {
      const list = publishedOnly 
        ? INITIAL_BLOG_POSTS.filter(b => b.published !== false)
        : INITIAL_BLOG_POSTS;
      return list.map((b, i) => ({ ...b, id: `seed-blog-${i}` })).filter(b => !deletedIds.has(b.id));
    }
    return snap.docs
      .map(d => {
        const postData = d.data() as BlogPost;
        const rawAuthor = postData.author || '';
        const cleanAuthor = (rawAuthor.toLowerCase().includes('sakshi') || rawAuthor.toLowerCase().includes('sandip'))
          ? 'NAVIORAA Technical Faculty'
          : (rawAuthor || 'NAVIORAA Technical Faculty');

        let coverImage = postData.coverImage || '';
        if (!coverImage || coverImage.includes('photo-1677442136019-21780efad99a') || postData.slug === 'applied-ai-llm-rag-systems') {
          coverImage = 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&auto=format&fit=crop&q=80';
        }

        return { ...postData, author: cleanAuthor, coverImage, id: d.id };
      })
      .filter(b => !deletedIds.has(b.id));
  } catch (error) {
    return INITIAL_BLOG_POSTS.map((b, i) => ({ ...b, id: `seed-blog-${i}` })).filter(b => !deletedIds.has(b.id));
  }
}

export async function saveBlogPost(post: Partial<BlogPost> & { id?: string }): Promise<string> {
  const colRef = collection(db, 'blogPosts');
  const docRef = post.id ? doc(colRef, post.id) : doc(colRef);
  const now = new Date().toISOString();
  const rawAuthor = post.author || '';
  const cleanAuthor = (rawAuthor.toLowerCase().includes('sakshi') || rawAuthor.toLowerCase().includes('sandip'))
    ? 'NAVIORAA Technical Faculty'
    : (rawAuthor || 'NAVIORAA Technical Faculty');

  const data = sanitizeForFirestore({
    ...post,
    id: docRef.id,
    author: cleanAuthor,
    published: post.published ?? true,
    updatedAt: now,
    createdAt: post.createdAt || now,
    publishedAt: post.publishedAt || (post.published ? now : undefined),
  });
  try {
    await setDoc(docRef, data, { merge: true });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `blogPosts/${docRef.id}`);
  }
}

export async function deleteBlogPost(id: string): Promise<void> {
  recordDeletedEntityId('blogPosts', id);
  try {
    await deleteDoc(doc(db, 'blogPosts', id));
  } catch (error) {
    console.warn('Firestore delete blogPost notice:', error);
  }
}

// ==================== SITE SETTINGS ====================

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const snap = await fetchWithTimeout(getDoc(doc(db, 'siteSettings', 'general')), 2000);
    if (snap.exists()) {
      const data = snap.data() as SiteSettings;
      const contactPhone =
        !data.contactPhone || data.contactPhone === '+91 98765 43210' || data.contactPhone === '+91 9890187383'
          ? '+91 8180999008'
          : data.contactPhone;
      const whatsappNumber =
        !data.whatsappNumber || data.whatsappNumber === '+919876543210' || data.whatsappNumber === '+919890187383'
          ? '+918180999008'
          : data.whatsappNumber;
      const contactEmail =
        !data.contactEmail || data.contactEmail === 'contact@navioraa.com' || data.contactEmail === 'naviora.pvt@gmail.com'
          ? 'support@navioraa.com'
          : data.contactEmail;

      return {
        ...INITIAL_SITE_SETTINGS,
        ...data,
        contactEmail,
        contactPhone,
        whatsappNumber,
        address: '', // Strict requirement: remove address completely across the site
      };
    }
    return INITIAL_SITE_SETTINGS;
  } catch (error) {
    return INITIAL_SITE_SETTINGS;
  }
}

export async function saveSiteSettings(settings: Partial<SiteSettings>): Promise<void> {
  try {
    const docRef = doc(db, 'siteSettings', 'general');
    const cleanSettings = sanitizeForFirestore({ ...settings, updatedAt: new Date().toISOString() });
    await setDoc(docRef, cleanSettings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'siteSettings/general');
  }
}

// ==================== ENQUIRIES LOCAL & CLOUD SYNC ====================

function getDeletedEnquiryIds(): Set<string> {
  try {
    const raw = localStorage.getItem('navioraa_deleted_enquiry_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch {}
  return new Set();
}

function recordDeletedEnquiryId(id: string): void {
  try {
    const current = getDeletedEnquiryIds();
    current.add(id);
    localStorage.setItem('navioraa_deleted_enquiry_ids', JSON.stringify(Array.from(current)));
  } catch {}
}

function getStoredLocalEnquiries(): Enquiry[] {
  try {
    const raw = localStorage.getItem('navioraa_stored_enquiries');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deletedIds = getDeletedEnquiryIds();
        return parsed.filter((e: Enquiry) => !deletedIds.has(e.id));
      }
    }
  } catch (e) {
    console.warn('Error reading stored enquiries:', e);
  }
  // Initialize with the standard initial inquiries
  try {
    localStorage.setItem('navioraa_stored_enquiries', JSON.stringify(INITIAL_ENQUIRIES));
  } catch {}
  return [...INITIAL_ENQUIRIES];
}

function saveStoredLocalEnquiries(list: Enquiry[]): void {
  try {
    localStorage.setItem('navioraa_stored_enquiries', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('navioraa_enquiries_updated', { detail: list }));
  } catch (e) {
    console.warn('Error saving stored enquiries:', e);
  }
}

export async function createEnquiry(enquiry: Omit<Enquiry, 'id' | 'status' | 'createdAt'>): Promise<{ id: string; emailNotificationSent: boolean; message: string }> {
  const colRef = collection(db, 'enquiries');
  const docRef = doc(colRef);
  const now = new Date().toISOString();

  let emailDelivered = false;
  let emailStatusNote = '';

  // 1. Send Notification Email via Server
  try {
    const apiRes = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...enquiry, enquiryId: docRef.id }),
    });

    const text = await apiRes.text();
    let apiData: any = {};
    try {
      apiData = text ? JSON.parse(text) : {};
    } catch {
      apiData = {};
    }

    if (apiRes.status === 400 && apiData.error) {
      throw new Error(apiData.error);
    }

    if (apiRes.ok && apiData.success) {
      emailDelivered = Boolean(apiData.emailDelivered);
      emailStatusNote = apiData.emailMessage || '';
    } else {
      emailDelivered = false;
      emailStatusNote = apiData.error || `Server responded with status ${apiRes.status}`;
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
      throw err;
    }
    console.info('Server email endpoint notice:', err);
    emailDelivered = false;
    emailStatusNote = 'Email provider unconfigured';
  }

  // 2. Build complete clean Enquiry object
  const cleanRecord: Enquiry = {
    id: docRef.id,
    fullName: enquiry.fullName,
    email: enquiry.email,
    phone: enquiry.phone,
    programOrService: enquiry.programOrService,
    subject: enquiry.subject || `Enquiry: ${enquiry.programOrService}`,
    message: enquiry.message,
    status: 'new',
    emailNotificationSent: emailDelivered,
    createdAt: now,
    updatedAt: now,
  };

  if (!emailDelivered && emailStatusNote) {
    cleanRecord.emailError = emailStatusNote;
  }

  // 3. Immediately store in local storage so inquiry instantly shows in Admin Panel
  const currentList = getStoredLocalEnquiries();
  const updatedList = [cleanRecord, ...currentList.filter(e => e.id !== cleanRecord.id)];
  saveStoredLocalEnquiries(updatedList);

  // 4. Persist to Firestore with timeout guard
  try {
    const firestoreData = sanitizeForFirestore(cleanRecord);
    await fetchWithTimeout(setDoc(docRef, firestoreData), 2500);
  } catch (error) {
    console.warn('Firestore database write notice for enquiry:', error);
  }

  const userFeedbackMessage = emailDelivered
    ? `Enquiry received! Confirmation notification delivered to admissions.`
    : `Enquiry received successfully! Our academic mentors will contact you within 2 working hours.`;

  return {
    id: docRef.id,
    emailNotificationSent: emailDelivered,
    message: userFeedbackMessage,
  };
}

export async function getEnquiries(): Promise<Enquiry[]> {
  const deletedIds = getDeletedEnquiryIds();
  const localList = getStoredLocalEnquiries().filter(e => !deletedIds.has(e.id));
  const map = new Map<string, Enquiry>();

  // Populate local inquiries first
  localList.forEach(e => {
    if (!deletedIds.has(e.id)) {
      map.set(e.id, e);
    }
  });

  // Try fetching from Firestore with timeout
  try {
    const snap = await fetchWithTimeout(getDocs(collection(db, 'enquiries')), 2500);
    if (!snap.empty) {
      snap.docs.forEach(d => {
        if (!deletedIds.has(d.id)) {
          const item = { ...d.data(), id: d.id } as Enquiry;
          map.set(item.id, item);
        }
      });
    }
  } catch (error) {
    console.info('Firestore getEnquiries notice:', error);
  }

  // Try fetching from server endpoint if available
  try {
    const res = await fetch('/api/enquiries');
    if (res.ok) {
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (data && Array.isArray(data.enquiries)) {
        data.enquiries.forEach((item: Enquiry) => {
          if (!deletedIds.has(item.id)) {
            map.set(item.id, item);
          }
        });
      }
    }
  } catch {
    // Ignore server offline
  }

  const items = Array.from(map.values()).filter(e => !deletedIds.has(e.id));
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateEnquiryStatus(
  id: string,
  updates: Partial<Pick<Enquiry, 'status' | 'assignedTo' | 'internalNotes' | 'followUpDate'>>
): Promise<void> {
  // Update in local store
  const currentList = getStoredLocalEnquiries();
  const updatedList = currentList.map(e =>
    e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
  );
  saveStoredLocalEnquiries(updatedList);

  // Notify server endpoint
  try {
    fetch(`/api/enquiries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});
  } catch {}

  // Update in Firestore
  try {
    const docRef = doc(db, 'enquiries', id);
    const cleanUpdates = sanitizeForFirestore({ ...updates, updatedAt: new Date().toISOString() });
    await setDoc(docRef, cleanUpdates, { merge: true });
  } catch (error) {
    console.warn('Firestore update notice for enquiry:', error);
  }

  window.dispatchEvent(new CustomEvent('navioraa_enquiries_updated', { detail: updatedList }));
}

export async function deleteEnquiry(id: string): Promise<void> {
  // 1. Immediately record in deleted IDs blocklist so it can never be resurrected
  recordDeletedEnquiryId(id);

  // 2. Delete from local store and dispatch update
  const currentList = getStoredLocalEnquiries();
  const updatedList = currentList.filter(e => e.id !== id);
  saveStoredLocalEnquiries(updatedList);

  // 3. Notify server endpoint
  try {
    fetch(`/api/enquiries/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  } catch {}

  // 4. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'enquiries', id));
  } catch (error) {
    console.warn('Firestore delete notice for enquiry:', error);
  }

  window.dispatchEvent(new CustomEvent('navioraa_enquiries_updated', { detail: updatedList }));
}

