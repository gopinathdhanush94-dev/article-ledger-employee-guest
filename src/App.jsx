import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient.js';
import { useAuth } from './lib/useAuth.js';
import { DialogProvider, useDialogs } from './components/Dialogs.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
import LoginModal from './components/LoginModal.jsx';
import Home from './components/Home.jsx';
import Catalog from './components/Catalog.jsx';
import AddProductForm from './components/AddProductForm.jsx';
import Garments from './components/Garments.jsx';
import GarmentForm from './components/GarmentForm.jsx';
import Calculator from './components/Calculator.jsx';
import DataQualityCenter from './components/DataQualityCenter.jsx';
import UserManagement from './components/UserManagement.jsx';
import ShowroomManager from './components/ShowroomManager.jsx';
import ShowroomOrders from './components/ShowroomOrders.jsx';
import AccessGate from './components/AccessGate.jsx';

const BrandIconSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="2" width="14" height="20" rx="2" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" />
    <path d="M7 7H13" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M7 11H13" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M7 15H10.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="18" cy="17" r="4" fill="#FFFFFF" />
    <path d="M16.6 17L17.6 18L19.6 15.6" stroke="#E4572E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);


function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-top-btn"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Back to top"
    >
      <span aria-hidden="true">↑</span>
      <span className="scroll-top-label">Top</span>
    </button>
  );
}

function AppInner() {
  const { isAuthed, signIn, signOut, profile, permissions, role, isEmployee } = useAuth();
  const { showToast } = useToast();
  const dialogs = useDialogs();

  const [view, setViewState] = useState('home');
  const [products, setProducts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [catalogFilters, setCatalogFilters] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showDataQuality, setShowDataQuality] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

  const [garments, setGarments] = useState([]);
  const [garmentsLoading, setGarmentsLoading] = useState(true);
  const [garmentsError, setGarmentsError] = useState(null);
  const [garmentsHasLoadedOnce, setGarmentsHasLoadedOnce] = useState(false);
  const [garmentFilters, setGarmentFilters] = useState(null);
  const [editingGarmentGroup, setEditingGarmentGroup] = useState(null);

  // ---------------- browser back/forward support ----------------
  const isPopRef = useRef(false);
  useEffect(() => {
    window.history.replaceState({ view: 'home' }, '', '#home');
    function onPop(e) {
      isPopRef.current = true;
      setViewState(e.state?.view || 'home');
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(nextView) {
    if (!isPopRef.current) {
      window.history.pushState({ view: nextView }, '', '#' + nextView);
    }
    isPopRef.current = false;
    setViewState(nextView);
  }

  // ---------------- data loading ----------------
  // Supabase/PostgREST caps a single select() response at 1000 rows by default,
  // regardless of how many rows actually exist — so anything past the first
  // 1000 silently gets cut off unless we page through with .range().
  async function fetchAllRows(table) {
    const pageSize = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      all = all.concat(data || []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  const loadProducts = useCallback(async () => {
    setDataLoading(true);
    try {
      const data = await fetchAllRows('products');
      setProducts(data);
      setDataError(null);
      setHasLoadedOnce(true);
    } catch (err) {
      setDataError(err.message);
    }
    setDataLoading(false);
  }, []);

  const loadGarments = useCallback(async () => {
    setGarmentsLoading(true);
    try {
      // Load garments independently of the General article list.
      // Avoid ordering by created_at here because some existing garment
      // tables may have been created by an older schema.
      const pageSize = 1000;
      let all = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('garments')
          .select('*')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      setGarments(all);
      setGarmentsError(null);
      setGarmentsHasLoadedOnce(true);
    } catch (err) {
      console.error('Garment load failed:', err);
      setGarmentsError(err.message || 'Unable to load garment data');
    } finally {
      setGarmentsLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); loadGarments(); }, [loadProducts, loadGarments]);

  function requireAuth(action) {
    if (isAuthed) { action(); return; }
    setPendingAction(() => action);
    setShowLogin(true);
  }

  async function handleLoginSubmit(email, password) {
    const err = await signIn(email, password);
    if (!err) {
      setShowLogin(false);
      if (pendingAction) { pendingAction(); setPendingAction(null); }
    }
    return err;
  }

  // ---------------- navigation actions ----------------
  function goHome() { navigate('home'); }

  function goToCatalog(filters) {
    setCatalogFilters({ ...filters, _t: Date.now() });
    navigate('catalog');
  }

  function goToGarments(filters) {
    setGarmentFilters({ ...filters, _t: Date.now() });
    navigate('garments');
  }

  function openAddChoice() {
    if (!permissions.canAdd) return showToast('Your account does not have permission to add products', 'error');
    requireAuth(() => {
      dialogs.choiceDialog({
        title: 'What would you like to add?',
        message: 'Choose which catalog this new entry belongs to.',
        options: [
          { label: 'General Article', icon: '📦', onClick: () => { setEditingProduct(null); navigate('add-product'); } },
          { label: 'Garment', icon: '👕', onClick: () => { setEditingGarmentGroup(null); navigate('add-garment'); } },
        ],
      });
    });
  }

  function openEditForm(product) {
    if (!permissions.canEdit) return showToast('Your account does not have permission to edit articles', 'error');
    requireAuth(() => { setEditingProduct(product); navigate('add-product'); });
  }

  function deleteProduct(product) {
    if (!permissions.canDelete) return showToast('Your account does not have permission to delete articles', 'error');
    requireAuth(() => {
      dialogs.confirmDialog({
        title: 'Delete this article?',
        message: `"${product.description || product.model || 'This article'}" will be permanently removed.`,
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
          const { error } = await supabase.from('products').delete().eq('id', product.id);
          if (error) { dialogs.alertDialog({ title: 'Could not delete', message: error.message }); showToast('Could not delete article', 'error'); }
          else { loadProducts(); showToast('Article deleted'); }
        },
      });
    });
  }

  function handleProductSaved(wasEditing, ean) {
    setEditingProduct(null);
    loadProducts();
    if (ean) {
      setCatalogFilters({ search: ean, autoOpen: true, _t: Date.now() });
      navigate('catalog');
    } else {
      navigate('catalog');
    }
    showToast(wasEditing ? 'Changes saved' : 'Article added');
  }

  function openEditGarment(group) {
    if (!permissions.canEdit) return showToast('Your account does not have permission to edit garments', 'error');
    requireAuth(() => { setEditingGarmentGroup(group); navigate('add-garment'); });
  }

  function deleteGarment(group) {
    if (!permissions.canDelete) return showToast('Your account does not have permission to delete garments', 'error');
    requireAuth(() => {
      dialogs.confirmDialog({
        title: 'Delete this garment style?',
        message: `"${group.excel_name || group.customer_model}" (${group.sizes.length} size${group.sizes.length === 1 ? '' : 's'}) will be permanently removed.`,
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
          const ids = group.sizes.map(s => s.id);
          const { error } = await supabase.from('garments').delete().in('id', ids);
          if (error) { dialogs.alertDialog({ title: 'Could not delete', message: error.message }); showToast('Could not delete garment', 'error'); }
          else { loadGarments(); showToast('Garment deleted'); }
        },
      });
    });
  }

  function handleGarmentSaved(wasEditing, styleName) {
    setEditingGarmentGroup(null);
    loadGarments();
    if (styleName) {
      setGarmentFilters({ search: styleName, _t: Date.now() });
      navigate('garments');
    } else {
      navigate('garments');
    }
    showToast(wasEditing ? 'Changes saved' : 'Garment style added');
  }

  return (
    <>
      <header>
        <div className="header-inner">
          <button className="brand-mark" onClick={goHome} title="Go to Home">
            <div className="brand-icon"><BrandIconSVG /></div>
            <div>
              <p className="eyebrow">G-Records</p>
              <h1>Article Ledger</h1>
            </div>
          </button>
          <div className="header-actions">
            {permissions.canDataQuality && <button
              type="button"
              className="header-tool-btn"
              onClick={() => setShowDataQuality(true)}
              title="Open Data Quality Center"
              aria-label="Open Data Quality Center"
            >
              <span aria-hidden="true">✓</span>
              <span>Data Quality</span>
            </button>}
            {permissions.canManageUsers && <button type="button" className="header-tool-btn" onClick={() => setShowUserManagement(true)} title="Manage users">
              <span aria-hidden="true">♙</span><span>Users</span>
            </button>}
            {isAuthed ? (
              <>
                <span className="who">Signed in · {role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'editor' ? 'Editor' : 'Viewer'}</span>
                <button className="btn" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <button className="btn" onClick={() => setShowLogin(true)}>Admin sign-in</button>
            )}
          </div>
        </div>
        <nav className="tabs">
          <button className={view === 'home' ? 'active' : ''} onClick={goHome}>🏠 Home</button>
          <button className={view === 'catalog' ? 'active' : ''} onClick={() => { setCatalogFilters(null); navigate('catalog'); }}>General</button>
          <button className={view === 'garments' ? 'active' : ''} onClick={() => { setGarmentFilters(null); navigate('garments'); }}>Garments</button>
          {permissions.canAdd && <button className={(view === 'add-product' || view === 'add-garment') ? 'active' : ''} onClick={openAddChoice}>+ Add Product</button>}
          {isEmployee && <button className={view === 'showroom' ? 'active' : ''} onClick={() => navigate('showroom')}>Showroom</button>}
          {permissions.canManageQuotations && <button className={view === 'showroom-orders' ? 'active' : ''} onClick={() => navigate('showroom-orders')}>Quotation Requests</button>}
        </nav>
      </header>

      {dataLoading && !hasLoadedOnce && (
        <div style={{ padding: 60, textAlign: 'center', fontFamily: "'Inter',sans-serif", color: 'var(--ink-soft)' }}>
          Loading catalog…
        </div>
      )}

      {dataError && !hasLoadedOnce && (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: "'Inter',sans-serif", color: 'var(--danger)' }}>
          Could not load products: {dataError}
          <br /><br />
          Check that VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set and that supabase/schema.sql has been run.
        </div>
      )}

      {dataError && hasLoadedOnce && (
        <div style={{ padding: '10px 32px', textAlign: 'center', fontFamily: "'Inter',sans-serif", fontSize: 13, color: 'var(--danger)', background: 'var(--danger-soft)', borderBottom: '1px solid var(--danger)' }}>
          Couldn't refresh products just now ({dataError}) — showing the last data that loaded successfully.
        </div>
      )}

      {hasLoadedOnce && (
        <>
          <div style={{ display: view === 'home' ? 'block' : 'none' }}>
            <Home products={products} garments={garments} onGoToCatalog={goToCatalog} onGoToGarments={goToGarments} />
          </div>
          <div style={{ display: view === 'catalog' ? 'block' : 'none' }}>
            <Catalog
              products={products}
              initialFilters={catalogFilters}
              onEdit={permissions.canEdit ? openEditForm : undefined}
              onDelete={permissions.canDelete ? deleteProduct : undefined}
              isAuthed={isAuthed}
              canEdit={permissions.canEdit}
              canDelete={permissions.canDelete}
            />
          </div>
          <div style={{ display: view === 'add-product' ? 'block' : 'none' }}>
            <AddProductForm
              products={products}
              editingProduct={editingProduct}
              onSaved={handleProductSaved}
              onCancel={() => { setEditingProduct(null); navigate('catalog'); }}
            />
          </div>
          <div style={{ display: view === 'garments' ? 'block' : 'none' }}>
            {garmentsLoading && !garmentsHasLoadedOnce && (
              <div style={{ padding: 60, textAlign: 'center', fontFamily: "'Inter',sans-serif", color: 'var(--ink-soft)' }}>
                Loading garments…
              </div>
            )}
            {garmentsError && !garmentsHasLoadedOnce && (
              <div style={{ padding: 40, textAlign: 'center', fontFamily: "'Inter',sans-serif", color: 'var(--danger)' }}>
                Could not load garments: {garmentsError}
                <br /><br />
                Check that supabase/garments_schema.sql has been run and the migration completed.
              </div>
            )}
            {garmentsError && garmentsHasLoadedOnce && (
              <div style={{ padding: '10px 20px', textAlign: 'center', fontFamily: "'Inter',sans-serif", fontSize: 13, color: 'var(--danger)', background: 'var(--danger-soft)', borderBottom: '1px solid var(--danger)' }}>
                Couldn't refresh garments just now ({garmentsError}) — showing the last data that loaded successfully.
              </div>
            )}
            {garmentsHasLoadedOnce && (
              <Garments garments={garments} initialFilters={garmentFilters} onEdit={permissions.canEdit ? openEditGarment : undefined} onDelete={permissions.canDelete ? deleteGarment : undefined} />
            )}
          </div>
          <div style={{ display: view === 'showroom' ? 'block' : 'none' }}>
            <ShowroomManager canEdit={permissions.canEdit} canDelete={permissions.canDelete} />
          </div>
          <div style={{ display: view === 'showroom-orders' ? 'block' : 'none' }}>
            <ShowroomOrders canManageQuotations={permissions.canManageQuotations} />
          </div>
          <div style={{ display: view === 'add-garment' ? 'block' : 'none' }}>
            <GarmentForm
              garments={garments}
              editingGroup={editingGarmentGroup}
              onSaved={handleGarmentSaved}
              onCancel={() => { setEditingGarmentGroup(null); navigate('garments'); }}
            />
          </div>
        </>
      )}

      <footer>Article Ledger — built with React + Supabase</footer>

      <div className="floating-tools" aria-label="Quick tools">
        <ScrollToTopButton />
        <button
          type="button"
          className="calculator-float-btn"
          onClick={() => setShowCalculator(true)}
          title="Open calculator"
          aria-label="Open calculator"
        >
          <svg className="calculator-float-icon" viewBox="0 0 48 48" aria-hidden="true">
            <rect x="8" y="4" width="32" height="40" rx="7" fill="currentColor"/>
            <rect x="12.5" y="9" width="23" height="8" rx="2.5" fill="var(--calc-display, #666)"/>
            <circle cx="16" cy="24" r="3.2" fill="#f4f4f4"/>
            <circle cx="24" cy="24" r="3.2" fill="#f4f4f4"/>
            <circle cx="32" cy="24" r="3.2" fill="#f59a00"/>
            <circle cx="16" cy="32" r="3.2" fill="#f4f4f4"/>
            <circle cx="24" cy="32" r="3.2" fill="#f4f4f4"/>
            <circle cx="32" cy="32" r="3.2" fill="#f59a00"/>
            <rect x="12.8" y="37" width="18.2" height="4.2" rx="2.1" fill="#f4f4f4"/>
          </svg>
        </button>
      </div>

      <Calculator open={showCalculator} onClose={() => setShowCalculator(false)} />

      <UserManagement
        open={showUserManagement}
        onClose={() => setShowUserManagement(false)}
        currentProfile={profile}
      />

      <DataQualityCenter
        open={showDataQuality}
        onClose={() => setShowDataQuality(false)}
        products={products}
        onGoToCatalog={goToCatalog}
      />

      {showLogin && (
        <LoginModal
          onClose={() => { setShowLogin(false); setPendingAction(null); }}
          onSubmit={handleLoginSubmit}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <DialogProvider>
      <ToastProvider>
        <AccessGate>
          <AppInner />
        </AccessGate>
      </ToastProvider>
    </DialogProvider>
  );
}
