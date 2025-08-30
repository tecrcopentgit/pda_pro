document.addEventListener("DOMContentLoaded", async () => {
  

  const medicationVal = document.querySelector(".medication_value");
  const medreportVal = document.querySelector(".med_report");
  const medtestVal = document.querySelector(".med_tests");

  // Get current user from token
  const token = localStorage.getItem('token');
  if (!token) return console.error("No token found");

  const payload = JSON.parse(atob(token.split('.')[1]));
  const currentUserId = payload.userId;

  // Fetch medication count dynamically
  try {
    const response = await fetch(`https://pda-pro-api.onrender.com/medications/${currentUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const medications = await response.json();
    medicationVal.textContent = medications.length;
  } catch (err) {
    console.error("Error fetching medications:", err);
  
  }

  try {
    const response = await fetch(`https://pda-pro-api.onrender.com/reports/user/${currentUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const s_reports = await response.json();
    medreportVal.textContent = s_reports.length;
  } catch (err) {
    console.error("Error fetching medications:", err);
    
  }


  try {
    const response = await fetch(`https://pda-pro-api.onrender.com/tests/user/${currentUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const s_reports = await response.json();
    medtestVal.textContent = s_reports.length;
  } catch (err) {
    console.error("Error fetching medications:", err);
    
  }
});
