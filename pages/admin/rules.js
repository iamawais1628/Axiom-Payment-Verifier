import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const RULE_TYPES = {
  amount_threshold: { label: 'Amount Threshold', icon: '💰', desc: 'Flag payments above a certain amount' },
  sender_rejection_count: { label: 'Repeat Rejections', icon: '🚫', desc: 'Flag senders with multiple rejections' },
}

const ACTIONS = {
  flag: { label: 'Flag for Review', color: '#d97706', bg: '#fffbeb' },
  auto_reject: { label: 'Auto Reject', color: '#dc2626', bg: '#fff5f5' },
  require_manager: { label: 'Require Manager', color: '#7c3aed', bg: '#f5f3ff' },
  notify_admin: { label: 'Notify Admin', color: '#2563eb', bg: '#eff6ff' },
}

export default function RulesEngine() {
  const [rules, setRules] = useState([])
  const [methods, setMethods] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [newRule, setNewRule] = useState({ name:'', rule_type:'amount_threshold', threshold_amount:500, threshold_count:2, action:'flag' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [showAddMethod, setShowAddMethod] = useState(false)
  const [newMethod, setNewMethod] = useState({ name:'', prefix:'', color:'#64748B' })
  const router = useRouter()

  useEffect(() => { init() }, [])

  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  const init = async () => {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data:prof } = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    if (prof?.role!=='admin') { router.replace('/'); return }
    loadRules()
    loadMethods()
  }

  const loadRules = async () => {
    const { data } = await supabase.from('payment_rules').select('*').order('created_at',{ascending:false})
    if (data) setRules(data)
  }

  const loadMethods = async () => {
    const { data } = await supabase.from('custom_methods').select('*').order('created_at',{ascending:false})
    if (data) setMethods(data)
  }

  const saveRule = async () => {
    if (!newRule.name) { showToast('Rule name required','error'); return }
    setSaving(true)
    await supabase.from('payment_rules').insert({
      name: newRule.name,
      rule_type: newRule.rule_type,
      threshold_amount: newRule.rule_type==='amount_threshold' ? parseFloat(newRule.threshold_amount) : null,
      threshold_count: newRule.rule_type==='sender_rejection_count' ? parseInt(newRule.threshold_count) : null,
      action: newRule.action,
      is_active: true,
    })
    showToast('Rule created')
    setShowAdd(false)
    setNewRule({ name:'', rule_type:'amount_threshold', threshold_amount:500, threshold_count:2, action:'flag' })
    loadRules()
    setSaving(false)
  }

  const toggleRule = async (rule) => {
    await supabase.from('payment_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    loadRules()
    showToast(rule.is_active ? 'Rule disabled' : 'Rule enabled')
  }

  const deleteRule = async (id) => {
    if (!confirm('Delete this rule?')) return
    await supabase.from('payment_rules').delete().eq('id', id)
    loadRules()
    showToast('Rule deleted')
  }

  const saveMethod = async () => {
    if (!newMethod.name) { showToast('Method name required','error'); return }
    setSaving(true)
    await supabase.from('custom_methods').insert({ name:newMethod.name, prefix:newMethod.prefix, color:newMethod.color })
    showToast('Payment method added')
    setShowAddMethod(false)
    setNewMethod({ name:'', prefix:'', color:'#64748B' })
    loadMethods()
    setSaving(false)
  }

  const deleteMethod = async (id) => {
    if (!confirm('Delete this payment method?')) return
    await supabase.from('custom_methods').delete().eq('id', id)
    loadMethods()
    showToast('Method deleted')
  }

  return (
    <Layout title="Rules & Settings">
      <style>{`
        .section { margin-bottom: 32px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .section-title { font-size: 16px; font-weight: 800; color: #0f172a; }
        .section-sub { font-size: 13px; color: #94a3b8; margin-top: 2px; }
        .add-btn { background: #1d4ed8; border: none; border-radius: 10px; color: #fff; font-size: 13px; font-weight: 700; padding: 9px 18px; cursor: pointer; font-family: 'Inter',sans-serif; transition: background 0.2s; }
        .add-btn:hover { background: #1e40af; }
        .rules-list { display: flex; flex-direction: column; gap: 10px; }
        .rule-card { background: #fff; border-radius: 14px; padding: 18px 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .rule-icon { font-size: 24px; width: 44px; height: 44px; background: #f8fafc; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rule-info { flex: 1; }
        .rule-name { font-size: 14px; font-weight: 700; color: #0f172a; }
        .rule-desc { font-size: 12px; color: #94a3b8; margin-top: 3px; }
        .rule-actions { display: flex; align-items: center; gap: 10px; }
        .toggle-btn { background: none; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 6px 14px; cursor: pointer; font-family: 'Inter',sans-serif; transition: all 0.15s; }
        .toggle-btn.active { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
        .toggle-btn.inactive { background: #f8fafc; color: #94a3b8; }
        .del-btn { background: none; border: 1.5px solid #fecaca; border-radius: 8px; color: #dc2626; font-size: 12px; font-weight: 700; padding: 6px 12px; cursor: pointer; font-family: 'Inter',sans-serif; }
        .del-btn:hover { background: #fff5f5; }
        .action-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .methods-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .method-card { background: #fff; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        .method-dot-big { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-weight: 800; flex-shrink: 0; }
        .method-name-big { font-size: 14px; font-weight: 700; color: #0f172a; }
        .method-prefix { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        .overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
        .modal { background: #fff; border-radius: 20px; padding: 32px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .modal-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 20px; }
        .field { margin-bottom: 16px; }
        .field label { display: block; font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.4px; margin-bottom: 7px; text-transform: uppercase; }
        .field input, .field select { width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 15px; color: #0f172a; font-size: 14px; font-family: 'Inter',sans-serif; outline: none; transition: border-color 0.2s; }
        .field input:focus, .field select:focus { border-color: #3b82f6; background: #fff; }
        .modal-actions { display: flex; gap: 10px; margin-top: 8px; }
        .btn-save { flex: 1; background: #1d4ed8; border: none; border-radius: 10px; padding: 13px; color: #fff; font-size: 14px; font-weight: 700; font-family: 'Inter',sans-serif; cursor: pointer; }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-cancel { flex: 1; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 13px; color: #475569; font-size: 14px; font-weight: 600; font-family: 'Inter',sans-serif; cursor: pointer; }
        .empty { text-align: center; padding: 40px; color: #cbd5e1; font-size: 13px; background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; }
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: slidein 0.3s ease; }
        .toast.success { background: #0f172a; color: #fff; }
        .toast.error { background: #dc2626; color: #fff; }
        @keyframes slidein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .color-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
        .color-chip { width: 28px; height: 28px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; transition: all 0.15s; }
        .color-chip.selected { border-color: #0f172a; transform: scale(1.2); }
      `}</style>

      {/* Rules Engine */}
      <div className="section">
        <div className="section-header">
          <div>
            <div className="section-title">🔧 Rules Engine</div>
            <div className="section-sub">Automatic flags and actions based on payment patterns</div>
          </div>
          <button className="add-btn" onClick={() => setShowAdd(true)}>+ Add Rule</button>
        </div>

        {rules.length === 0 ? (
          <div className="empty">No rules yet. Add your first rule to automate fraud detection.</div>
        ) : (
          <div className="rules-list">
            {rules.map(rule => {
              const rt = RULE_TYPES[rule.rule_type] || { label: rule.rule_type, icon: '⚙️' }
              const ac = ACTIONS[rule.action] || ACTIONS.flag
              return (
                <div key={rule.id} className="rule-card" style={{ opacity: rule.is_active ? 1 : 0.5 }}>
                  <div className="rule-icon">{rt.icon}</div>
                  <div className="rule-info">
                    <div className="rule-name">{rule.name}</div>
                    <div className="rule-desc">
                      {rule.rule_type === 'amount_threshold' && `Triggers when payment exceeds $${rule.threshold_amount}`}
                      {rule.rule_type === 'sender_rejection_count' && `Triggers when sender has ${rule.threshold_count || 2}+ rejections`}
                    </div>
                  </div>
                  <span className="action-badge" style={{ background: ac.bg, color: ac.color }}>{ac.label}</span>
                  <div className="rule-actions">
                    <button className={`toggle-btn ${rule.is_active ? 'active' : 'inactive'}`} onClick={() => toggleRule(rule)}>
                      {rule.is_active ? '✓ Active' : '○ Disabled'}
                    </button>
                    <button className="del-btn" onClick={() => deleteRule(rule.id)}>🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Custom Payment Methods */}
      <div className="section">
        <div className="section-header">
          <div>
            <div className="section-title">💳 Custom Payment Methods</div>
            <div className="section-sub">Add payment methods specific to your region or business</div>
          </div>
          <button className="add-btn" onClick={() => setShowAddMethod(true)}>+ Add Method</button>
        </div>

        {methods.length === 0 ? (
          <div className="empty">No custom methods yet. Add regional payment apps your team uses.</div>
        ) : (
          <div className="methods-grid">
            {methods.map(m => (
              <div key={m.id} className="method-card">
                <div className="method-dot-big" style={{ background: m.color }}>{m.prefix || m.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div className="method-name-big">{m.name}</div>
                  {m.prefix && <div className="method-prefix">Prefix: {m.prefix}</div>}
                </div>
                <button className="del-btn" onClick={() => deleteMethod(m.id)}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Rule Modal */}
      {showAdd && (
        <div className="overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Rule</div>
            <div className="field">
              <label>Rule Name</label>
              <input value={newRule.name} onChange={e => setNewRule({...newRule, name:e.target.value})} placeholder="e.g. Large Payment Alert" />
            </div>
            <div className="field">
              <label>Rule Type</label>
              <select value={newRule.rule_type} onChange={e => setNewRule({...newRule, rule_type:e.target.value})}>
                {Object.entries(RULE_TYPES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {newRule.rule_type === 'amount_threshold' && (
              <div className="field">
                <label>Amount Threshold ($)</label>
                <input type="number" value={newRule.threshold_amount} onChange={e => setNewRule({...newRule, threshold_amount:e.target.value})} />
              </div>
            )}
            {newRule.rule_type === 'sender_rejection_count' && (
              <div className="field">
                <label>Number of Rejections</label>
                <input type="number" value={newRule.threshold_count} onChange={e => setNewRule({...newRule, threshold_count:e.target.value})} />
              </div>
            )}
            <div className="field">
              <label>Action</label>
              <select value={newRule.action} onChange={e => setNewRule({...newRule, action:e.target.value})}>
                {Object.entries(ACTIONS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-save" onClick={saveRule} disabled={saving}>{saving ? 'Saving...' : 'Create Rule'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Method Modal */}
      {showAddMethod && (
        <div className="overlay" onClick={() => setShowAddMethod(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Payment Method</div>
            <div className="field">
              <label>Method Name</label>
              <input value={newMethod.name} onChange={e => setNewMethod({...newMethod, name:e.target.value})} placeholder="e.g. bKash, Wave, M-Pesa" />
            </div>
            <div className="field">
              <label>Prefix (optional)</label>
              <input value={newMethod.prefix} onChange={e => setNewMethod({...newMethod, prefix:e.target.value})} placeholder="e.g. 01, +880" />
            </div>
            <div className="field">
              <label>Color</label>
              <div className="color-row">
                {['#e11d48','#dc2626','#d97706','#16a34a','#2563eb','#7c3aed','#0891b2','#0f172a','#64748b'].map(c => (
                  <div key={c} className={`color-chip${newMethod.color===c?' selected':''}`} style={{background:c}} onClick={() => setNewMethod({...newMethod, color:c})} />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAddMethod(false)}>Cancel</button>
              <button className="btn-save" onClick={saveMethod} disabled={saving}>{saving ? 'Saving...' : 'Add Method'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </Layout>
  )
}
