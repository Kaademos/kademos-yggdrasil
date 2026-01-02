/**
 * Asgard HR Portal
 * 
 */

import { employeeApi, documentApi, diagnosticsApi } from './api-client.js';

// Section Management
window.showSection = function(sectionName) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Remove active class from all nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Show target section
  const targetSection = document.getElementById(`${sectionName}-section`);
  if (targetSection) {
    targetSection.style.display = 'block';
  }
  
  // Set active nav item
  const activeNav = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
  if (activeNav && !activeNav.classList.contains('disabled')) {
    activeNav.classList.add('active');
  }
  
  // Load data for the section
  if (sectionName === 'employees') {
    loadEmployees();
  } else if (sectionName === 'documents') {
    loadDocuments();
  }
};

// Load Employees
window.loadEmployees = async function() {
  const tbody = document.getElementById('employees-tbody');
  tbody.innerHTML = '<tr><td colspan="5"><div class="loading"></div> Loading...</td></tr>';
  
  try {
    const response = await employeeApi.list();
    
    if (response.success && response.employees) {
      if (response.employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No employees found</td></tr>';
        return;
      }
      
      tbody.innerHTML = response.employees.map(emp => `
        <tr>
          <td>${emp.id}</td>
          <td>${emp.name}</td>
          <td>${emp.department}</td>
          <td>${emp.role}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="viewEmployee(${emp.id})">
              View Profile
            </button>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Failed to load employees</td></tr>';
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color: var(--accent-danger);">Error: ${error.message}</td></tr>`;
  }
};

// View Employee Profile
window.viewEmployee = async function(id) {
  try {
    const response = await employeeApi.getById(id);
    
    if (response.success && response.employee) {
      const emp = response.employee;
      showModal('Employee Profile', `
        <div style="line-height: 1.8;">
          <p><strong>ID:</strong> ${emp.id}</p>
          <p><strong>Username:</strong> ${emp.username}</p>
          <p><strong>Name:</strong> ${emp.name}</p>
          <p><strong>Email:</strong> ${emp.email}</p>
          <p><strong>Department:</strong> ${emp.department}</p>
          <p><strong>Role:</strong> ${emp.role}</p>
          <p><strong>Created:</strong> ${new Date(emp.created_at).toLocaleDateString()}</p>
        </div>
      `);
    } else {
      showModal('Error', '<p style="color: var(--accent-danger);">Failed to load employee profile</p>');
    }
  } catch (error) {
    showModal('Error', `<p style="color: var(--accent-danger);">${error.message}</p>`);
  }
};

// Search Employees
window.searchEmployees = async function() {
  const query = document.getElementById('employee-search').value;
  const resultsDiv = document.getElementById('search-results');
  
  if (!query.trim()) {
    resultsDiv.style.display = 'none';
    return;
  }
  
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = '<div class="card"><div class="card-body"><div class="loading"></div> Searching...</div></div>';
  
  try {
    const response = await employeeApi.search(query);
    
    if (response.success && response.results) {
      if (response.results.length === 0) {
        resultsDiv.innerHTML = '<div class="card"><div class="card-body">No results found</div></div>';
        return;
      }
      
      resultsDiv.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Search Results (${response.results.length})</h2>
          </div>
          <div class="card-body">
            <pre>${JSON.stringify(response.results, null, 2)}</pre>
          </div>
        </div>
      `;
    } else {
      resultsDiv.innerHTML = '<div class="card"><div class="card-body" style="color: var(--accent-danger);">Search failed</div></div>';
    }
  } catch (error) {
    resultsDiv.innerHTML = `<div class="card"><div class="card-body" style="color: var(--accent-danger);">Error: ${error.message}</div></div>`;
  }
};

// Load Documents
window.loadDocuments = async function() {
  const container = document.getElementById('documents-list');
  container.innerHTML = '<div class="loading"></div> Loading...';
  
  try {
    const response = await documentApi.list();
    
    if (response.success && response.documents) {
      if (response.documents.length === 0) {
        container.innerHTML = '<div class="empty-state">No documents found</div>';
        return;
      }
      
      container.innerHTML = response.documents.map(doc => `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-header">
            <h3 class="card-title">${doc.title}</h3>
            <span class="badge ${
              doc.access_level === 'public' ? 'badge-success' : 
              doc.access_level === 'admin' ? 'badge-danger' : 
              'badge-default'
            }">${doc.access_level}</span>
          </div>
          <div class="card-body">
            <button class="btn btn-secondary btn-sm" onclick="viewDocument(${doc.id})">
              View Document
            </button>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div class="empty-state" style="color: var(--accent-danger);">Failed to load documents</div>';
    }
  } catch (error) {
    container.innerHTML = `<div class="empty-state" style="color: var(--accent-danger);">Error: ${error.message}</div>`;
  }
};

// View Document
window.viewDocument = async function(id) {
  try {
    const response = await documentApi.getById(id);
    
    if (response.success && response.document) {
      const doc = response.document;
      showModal(doc.title, `
        <div style="line-height: 1.8;">
          <p><strong>ID:</strong> ${doc.id}</p>
          <p><strong>Access Level:</strong> <span class="badge ${
            doc.access_level === 'public' ? 'badge-success' : 
            doc.access_level === 'admin' ? 'badge-danger' : 
            'badge-default'
          }">${doc.access_level}</span></p>
          <p><strong>Owner ID:</strong> ${doc.owner_id}</p>
          <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border-color);">
          <div style="white-space: pre-wrap; color: var(--text-secondary);">${doc.content}</div>
        </div>
      `);
    } else {
      showModal('Error', '<p style="color: var(--accent-danger);">Failed to load document</p>');
    }
  } catch (error) {
    showModal('Error', `<p style="color: var(--accent-danger);">${error.message}</p>`);
  }
};


window.captureURL = async function() {
  const url = document.getElementById('diagnostic-url').value;
  const resultDiv = document.getElementById('diagnostic-result');
  
  if (!url) {
    alert('Please enter a URL');
    return;
  }
  
  resultDiv.innerHTML = '<div class="result-panel"><div class="loading"></div> Capturing URL...</div>';
  
  try {
    const response = await diagnosticsApi.captureUrl(url);
    
    if (response.success) {
      resultDiv.innerHTML = `
        <div class="result-panel result-success">
          <h4 style="margin-bottom: 8px; color: var(--accent-success);">✓ Success</h4>
          <p><strong>URL:</strong> ${response.url}</p>
          <p><strong>Status Code:</strong> ${response.statusCode}</p>
          <pre>${JSON.stringify(response.data, null, 2)}</pre>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="result-panel result-error">
          <h4 style="margin-bottom: 8px; color: var(--accent-danger);">✗ Blocked</h4>
          <p><strong>Error:</strong> ${response.error}</p>
          ${response.filterResult && response.filterResult.bypassHints ? `
            <p style="margin-top: 12px;"><strong>Hints:</strong></p>
            <ul style="margin-left: 20px; line-height: 1.6;">
              ${response.filterResult.bypassHints.map(hint => `<li>${hint}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="result-panel result-error">
        <h4 style="color: var(--accent-danger);">Error</h4>
        <p>${error.message}</p>
      </div>
    `;
  }
};

// Modal Management
window.showModal = function(title, content) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = content;
  document.getElementById('modal-overlay').style.display = 'flex';
};

window.closeModal = function() {
  document.getElementById('modal-overlay').style.display = 'none';
};


document.addEventListener('DOMContentLoaded', () => {
  
  loadEmployees();
});
