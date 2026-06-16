document.addEventListener('DOMContentLoaded', () => {
    const monthInput = document.getElementById('action-month');
    const weekSelect = document.getElementById('action-week');
    const headRow = document.getElementById('table-head-row');
    const tbody = document.getElementById('table-body');
    let currentWeeks = [];
    let globalData = { members: [], payments: [] };

    // Elements for Stats
    const statTotalMembers = document.getElementById('stat-total-members');
    const statPaid = document.getElementById('stat-paid');
    const statUnpaid = document.getElementById('stat-unpaid');
    const statAmount = document.getElementById('stat-amount');

    // Modal elements
    const modalAddMember = document.getElementById('modal-add-member');
    const btnAddMember = document.getElementById('btn-add-member');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnSaveMember = document.getElementById('btn-save-member');
    const inputMemberName = document.getElementById('input-member-name');
    const inputMemberDiscord = document.getElementById('input-member-discord');

    // Set initial month to current month
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    monthInput.value = currentMonthStr;

    // Get Sundays in a specific month (YYYY-MM)
    function getSundaysInMonth(yearMonth) {
        const [year, month] = yearMonth.split('-').map(Number);
        const sundays = [];
        const date = new Date(year, month - 1, 1);
        while (date.getMonth() === month - 1) {
            if (date.getDay() === 0) { // Sunday
                sundays.push(`${date.getDate()}/${date.getMonth() + 1}`);
            }
            date.setDate(date.getDate() + 1);
        }
        return sundays;
    }

    function renderTableHeaders() {
        // Clear old weeks
        while (headRow.children.length > 2) {
            headRow.removeChild(headRow.lastChild);
        }
        weekSelect.innerHTML = '';

        const todayStr = `${today.getDate()}/${today.getMonth() + 1}`;
        let nearestWeek = currentWeeks[0];

        currentWeeks.forEach(week => {
            // Table header
            const th = document.createElement('th');
            th.textContent = week;
            if (week === todayStr) th.classList.add('current-week');
            headRow.appendChild(th);
            
            // Select option
            const option = document.createElement('option');
            option.value = week;
            option.textContent = week;
            weekSelect.appendChild(option);
            
            if (week === todayStr) nearestWeek = week;
        });
        
        if (currentWeeks.includes(nearestWeek)) {
            weekSelect.value = nearestWeek;
        }
    }

    function updateStats() {
        if (!globalData.members.length) return;
        const currentSelectedWeek = weekSelect.value;
        
        statTotalMembers.textContent = globalData.members.length;
        
        let paidCount = 0;
        let unpaidCount = 0;
        
        if (currentSelectedWeek) {
            globalData.members.forEach(member => {
                const payment = globalData.payments.find(p => p.member_id === member.id && p.week_date === currentSelectedWeek);
                if (payment && payment.is_paid === 1) paidCount++;
                else unpaidCount++;
            });
        }
        
        statPaid.textContent = paidCount;
        statUnpaid.textContent = unpaidCount;
        statAmount.textContent = (paidCount * 300000).toLocaleString();
    }

    // Load Data
    function loadData() {
        // Show loading state
        tbody.innerHTML = `<tr class="empty-row"><td colspan="10"><div class="skeleton" style="height: 40px; width: 100%;"></div></td></tr>`;
        
        fetch('/api/data')
            .then(res => res.json())
            .then(data => {
                globalData = data;
                renderTableBody();
                updateStats();
            })
            .catch(err => showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error'));
    }

    function renderTableBody() {
        tbody.innerHTML = '';
        
        if (globalData.members.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="10">ไม่มีรายชื่อสมาชิก</td></tr>`;
            return;
        }

        globalData.members.forEach((member, index) => {
            const tr = document.createElement('tr');
            
            // Seq
            const tdSeq = document.createElement('td');
            tdSeq.className = 'sticky-col col-seq';
            tdSeq.innerHTML = `<div class="seq-num">${index + 1}</div>`;
            tr.appendChild(tdSeq);
            
            // Name
            const tdName = document.createElement('td');
            tdName.className = 'sticky-col col-name';
            
            // Generate initials for avatar
            const initials = member.name.substring(0, 2).toUpperCase();
            
            tdName.innerHTML = `
                <div class="member-info">
                    <div class="member-avatar">${initials}</div>
                    <div class="member-details" style="flex: 1;">
                        <div class="member-name">${member.name}</div>
                    </div>
                    <button class="btn-edit-member" data-id="${member.id}" title="แก้ไขข้อมูล">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-delete-member" data-id="${member.id}" title="ลบรายชื่อ">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            tr.appendChild(tdName);
            
            // Edit Listener
            const btnEdit = tdName.querySelector('.btn-edit-member');
            btnEdit.addEventListener('click', () => {
                openModalForEdit(member.id, member.name, member.discord_id);
            });
            
            // Delete Listener
            const btnDelete = tdName.querySelector('.btn-delete-member');
            btnDelete.addEventListener('click', () => {
                if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${member.name} ? ข้อมูลการจ่ายเงินทั้งหมดจะหายไปด้วย!`)) {
                    deleteMember(member.id);
                }
            });
            
            // Weeks
            currentWeeks.forEach(week => {
                const td = document.createElement('td');
                td.className = 'check-cell';
                
                const payment = globalData.payments.find(p => p.member_id === member.id && p.week_date === week);
                const isPaid = payment && payment.is_paid === 1;
                
                td.innerHTML = `
                    <label class="check-label">
                        <input type="checkbox" class="payment-check" data-member="${member.id}" data-week="${week}" ${isPaid ? 'checked' : ''}>
                        <div class="check-box">
                            <i class="fa-solid fa-check check-icon"></i>
                        </div>
                    </label>
                `;
                
                // Add event listener to the checkbox inside
                const checkbox = td.querySelector('input');
                checkbox.addEventListener('change', (e) => togglePayment(member.id, week, e.target.checked));
                
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
    }

    // Toggle Payment API
    function togglePayment(memberId, week, isPaid) {
        fetch('/api/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                member_id: memberId,
                week_date: week,
                is_paid: isPaid ? 1 : 0
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Update local data
                let paymentIndex = globalData.payments.findIndex(p => p.member_id === memberId && p.week_date === week);
                if (paymentIndex >= 0) {
                    globalData.payments[paymentIndex].is_paid = isPaid ? 1 : 0;
                } else {
                    globalData.payments.push({ member_id: memberId, week_date: week, amount: 300000, is_paid: isPaid ? 1 : 0 });
                }
                
                updateStats();
                showToast('อัปเดตสถานะการจ่ายเงินเรียบร้อย', 'success');
            } else {
                showToast('เกิดข้อผิดพลาดในการอัปเดต!', 'error');
            }
        }).catch(() => showToast('Network Error', 'error'));
    }

    // Delete Member API
    function deleteMember(id) {
        fetch(`/api/members/${id}`, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('ลบรายชื่อเรียบร้อยแล้ว', 'success');
                loadData();
            } else {
                showToast('ไม่สามารถลบได้!', 'error');
            }
        }).catch(() => showToast('Network Error', 'error'));
    }

    // Event listener for month change
    monthInput.addEventListener('change', (e) => {
        if (e.target.value) {
            currentWeeks = getSundaysInMonth(e.target.value);
            renderTableHeaders();
            renderTableBody();
            updateStats();
        }
    });

    // Event listener for week select change
    weekSelect.addEventListener('change', () => {
        updateStats();
    });

    // Discord APIs
    document.getElementById('btn-notify').addEventListener('click', () => {
        const week = weekSelect.value;
        if (!week) return showToast('กรุณาเลือกสัปดาห์ก่อน', 'error');
        
        showToast('กำลังส่งแจ้งเตือนไปที่ Discord...', 'info');
        fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ week_date: week })
        })
        .then(res => res.json())
        .then(data => {
            if(data.success) showToast(data.message || 'ส่งแจ้งเตือนทวงเงินเรียบร้อย!', 'success');
            else showToast('ส่งไม่สำเร็จ', 'error');
        })
        .catch(err => showToast('Error', 'error'));
    });

    document.getElementById('btn-summary').addEventListener('click', () => {
        const week = weekSelect.value;
        if (!week) return showToast('กรุณาเลือกสัปดาห์ก่อน', 'error');
        
        showToast('กำลังสรุปยอดลง Discord...', 'info');
        fetch('/api/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ week_date: week })
        })
        .then(res => res.json())
        .then(data => {
            if(data.success) showToast('สรุปยอดลง Discord เรียบร้อย!', 'success');
            else showToast('ส่งไม่สำเร็จ', 'error');
        })
        .catch(err => showToast('Error', 'error'));
    });

    // Member Modal Logic (Add & Edit)
    let currentEditId = null;
    const modalTitle = document.querySelector('.modal-title');

    btnAddMember.addEventListener('click', () => {
        currentEditId = null;
        modalTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> เพิ่มสมาชิกใหม่';
        modalAddMember.classList.add('open');
        inputMemberName.value = '';
        inputMemberDiscord.value = '';
        inputMemberName.focus();
    });

    function openModalForEdit(id, name, discordId) {
        currentEditId = id;
        modalTitle.innerHTML = '<i class="fa-solid fa-user-pen"></i> แก้ไขข้อมูลสมาชิก';
        modalAddMember.classList.add('open');
        inputMemberName.value = name;
        inputMemberDiscord.value = discordId || '';
        inputMemberName.focus();
    }

    btnCloseModal.addEventListener('click', () => {
        modalAddMember.classList.remove('open');
    });

    btnSaveMember.addEventListener('click', () => {
        const name = inputMemberName.value.trim();
        const discord_id = inputMemberDiscord.value.trim();
        
        if (!name) return showToast('กรุณากรอกชื่อสมาชิก', 'error');
        
        const url = currentEditId ? `/api/members/${currentEditId}` : '/api/members';
        const method = currentEditId ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, discord_id })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast(currentEditId ? 'แก้ไขข้อมูลเรียบร้อย' : 'เพิ่มสมาชิกรหัสใหม่เรียบร้อย', 'success');
                modalAddMember.classList.remove('open');
                loadData(); // Reload data to show new/updated member
            } else {
                showToast('เกิดข้อผิดพลาด', 'error');
            }
        })
        .catch(() => showToast('Network Error', 'error'));
    });

    // Toast UI Manager
    const toastContainer = document.getElementById('toast-container');
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';
        
        toast.innerHTML = `
            <i class="fa-solid ${icon} toast-icon"></i>
            <div>${message}</div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); // Wait for transition out
        }, 3000);
    }

    // Initial setup
    currentWeeks = getSundaysInMonth(monthInput.value);
    renderTableHeaders();
    loadData();
});
