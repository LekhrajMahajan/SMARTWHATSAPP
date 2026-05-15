from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from webdriver_manager.chrome import ChromeDriverManager

import time
import random
import os
from datetime import datetime, timedelta
from models import get_ist_time, is_within_ist_window


def type_message_with_newlines(driver, message_box, message):
    """
    Types a message that may contain paragraphs and links.
    Uses direct send_keys with SHIFT+ENTER for newlines.
    This works on headless Linux servers where pyperclip (clipboard) is not available.
    """
    # Split message by newline and send each part
    lines = message.split('\n')
    for i, line in enumerate(lines):
        message_box.send_keys(line)
        if i < len(lines) - 1:
            # Add a newline without sending the message
            message_box.send_keys(Keys.SHIFT, Keys.ENTER)
    
    # Trigger link recognition by sending a space and backspace
    # This 'wakes up' the WhatsApp input handler to linkify URLs
    time.sleep(0.5)
    message_box.send_keys(Keys.SPACE)
    time.sleep(0.2)
    message_box.send_keys(Keys.BACKSPACE)
    
    # Wait for link preview/processing
    time.sleep(1.0)


def wait_for_message_to_send(driver, wait, timeout=30):
    """
    Waits until the message input box is empty — confirming the message was sent.
    This ensures we stay on the current contact's chat until the message is fully delivered.
    """
    selectors = [
        '//div[@contenteditable="true"][@data-tab="10"]',
        '//div[@title="Type a message"]',
        '//footer//div[@contenteditable="true"]',
        '//div[@role="textbox"]'
    ]
    
    try:
        def is_empty(d):
            for xpath in selectors:
                try:
                    el = d.find_element(By.XPATH, xpath)
                    if el.text == "":
                        return True
                except:
                    continue
            return False

        wait.until(is_empty)
        return True
    except Exception:
        # Fallback: if we can't confirm, wait a fixed time
        time.sleep(2)
        return False


def send_messages(contacts, template, username="default", on_status=None, logs_collection=None, broadcast_func=None):
    """
    Sends messages with specific restrictions:
    - Only between 10 AM and 6 PM IST.
    - Max 100 people per batch.
    - 1 hour cooldown between batches.
    - Max 800 people per day.
    """
    results = {
        "status": "completed",
        "sent_count": 0,
        "failed_count": 0,
        "total_attempted": 0
    }
    
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--single-process")
    options.add_argument("--no-zygote")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--disable-default-apps")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-sync")
    options.add_argument("--disable-translate")
    options.add_argument("--metrics-recording-only")
    options.add_argument("--safebrowsing-disable-auto-update")
    options.add_argument("--no-first-run")
    options.add_argument("--mute-audio")
    options.add_argument("--hide-scrollbars")
    # REMOVE remote-debugging-port as it causes conflicts between users
    # options.add_argument("--remote-debugging-port=9222")
    options.add_argument("--proxy-bypass-list=*")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--disable-dev-config")
    
    # Disable images to save massive RAM
    prefs = {"profile.managed_default_content_settings.images": 2}
    options.add_experimental_option("prefs", prefs)
    options.add_argument("--blink-settings=imagesEnabled=false")
    
    # Headless mode for cloud deployment (Render/Linux)
    # FORCING TRUE by default for Render stability
    is_headless = os.getenv("HEADLESS", "true").lower() == "true"
    
    if is_headless:
        print("🌐 Running in HEADLESS mode (Forced for stability)")
        options.add_argument("--headless=new")
        # Smaller window size = Much less RAM usage
        options.add_argument("--window-size=800,600")
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    # Explicitly set Chrome binary path for Linux environments
    for path in ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]:
        if os.path.exists(path):
            options.binary_location = path
            break

    # Use /tmp for profile in production to avoid permission/crash issues on Render
    # Append username to make it unique per user
    if os.getenv("HEADLESS", "false").lower() == "true":
        profile_path = f"/tmp/chrome_profile_{username}"
    else:
        profile_path = os.path.abspath(f"chrome_profile_{username}")
    
    if not os.path.exists(profile_path):
        os.makedirs(profile_path, exist_ok=True)
        
    options.add_argument(f"user-data-dir={profile_path}")

    driver = None
    
    try:
        total_contacts = len(contacts)
        
        for i in range(0, total_contacts, 100):
            # 1. CHECK DAILY LIMIT (800)
            if logs_collection is not None:
                today = get_ist_time().replace(hour=0, minute=0, second=0, microsecond=0)
                sent_today = logs_collection.count_documents({
                    "status": "Sent",
                    "created_at": {"$gte": today}
                })
                
                if sent_today >= 800:
                    print("🚫 Daily limit of 800 reached. Stopping for today.")
                    if broadcast_func:
                        broadcast_func({"type": "DAILY_LIMIT_REACHED", "data": {"sent": sent_today}})
                    results["status"] = "daily_limit_reached"
                    break
            
            # 2. CHECK TIME WINDOW (10 AM - 6 PM)
            is_waiting_for_window = False
            while not is_within_ist_window(10, 18):
                if not is_waiting_for_window:
                    print("⏳ Outside sending window (10 AM - 6 PM). Waiting...")
                    if broadcast_func:
                        broadcast_func({"type": "WAITING_FOR_WINDOW", "data": {"start_hour": 10}})
                    is_waiting_for_window = True
                time.sleep(60) 
            
            if is_waiting_for_window:
                if broadcast_func:
                    broadcast_func({"type": "WINDOW_RESUMED", "data": {}})
                is_waiting_for_window = False

            # Get current batch
            batch = contacts[i:i+100]
            print(f"📦 Processing batch of {len(batch)} contacts ({i+1} to {min(i+100, total_contacts)})")

            # Initialize driver if not already open
            if not driver:
                print(f"[{username}] 🌐 Running in HEADLESS mode (Forced for stability)")
                # System-wide chromedriver path (standard for Linux/Docker)
                driver_path = "/usr/bin/chromedriver"
                
                if os.path.exists(driver_path):
                    print(f"[{username}] 🚀 Using system chromedriver at {driver_path}")
                    service = Service(executable_path=driver_path)
                else:
                    # Fallback for local development
                    print(f"[{username}] 🏠 Using webdriver_manager for local development")
                    service = Service(ChromeDriverManager().install())

                driver = webdriver.Chrome(
                    service=service,
                    options=options
                )
                print(f"[{username}] ✅ Browser started successfully.")
                wait = WebDriverWait(driver, 300)
                send_wait = WebDriverWait(driver, 30)

                driver.get("https://web.whatsapp.com")
                print(f"[{username}] Waiting for WhatsApp login...")
                
                # QR Code relay for headless mode
                login_check_iterations = 0
                while login_check_iterations < 60:  # 5 minutes max (5s * 60)
                    try:
                        # Check if logged in
                        if driver.find_elements(By.ID, "pane-side"):
                            print(f"[{username}] ✅ WhatsApp Logged In Successfully")
                            break
                        
                        # Look for QR code
                        try:
                            qr_elements = driver.find_elements(By.CSS_SELECTOR, "canvas")
                            if qr_elements and broadcast_func:
                                # Take screenshot of the QR code canvas
                                qr_base64 = qr_elements[0].screenshot_as_base64
                                broadcast_func({
                                    "type": "QR_CODE",
                                    "data": {"image": f"data:image/png;base64,{qr_base64}"}
                                })
                                print(f"[{username}] 📲 QR Code sent to frontend")
                        except Exception as e:
                            print(f"[{username}] Error capturing QR: {e}")
                        
                    except Exception as e:
                        print(f"[{username}] Error during login check: {e}")
                    
                    time.sleep(5)
                    login_check_iterations += 1
                
                # Final check after loop
                if not driver.find_elements(By.ID, "pane-side"):
                    print(f"[{username}] ❌ Login timeout or failed")
                    if driver: driver.quit()
                    results["status"] = "login_failed"
                    return results

            # SEND BATCH
            for contact in batch:
                contact_start_time = time.time()
                results["total_attempted"] += 1
                # Double check time window inside the batch
                if not is_within_ist_window(10, 18):
                    print("⏳ Window closed during batch. Pausing.")
                    results["status"] = "window_closed"
                    break

                try:
                    name = contact["name"]
                    number = str(contact["number"]).strip()
                    
                    # Ensure number is in international format (default to 91 for 10 digits)
                    if len(number) == 10 and number.isdigit():
                        number = "91" + number
                        
                    message = template.replace("{name}", name)

                    print(f"[{username}] Sending to {name} ({number})")
                    url = f"https://web.whatsapp.com/send?phone={number}"
                    driver.get(url)

                    # Wait for the message box with a more reasonable timeout (60s)
                    # and check for common failure modals
                    message_box = None
                    start_time = time.time()
                    
                    # Robust selectors for WhatsApp message box (Updated for 2025 Lexical Editor)
                    box_selectors = [
                        '//div[@contenteditable="true"][@data-tab="10"]',
                        '//div[@title="Type a message"]',
                        '//div[@role="textbox"]',
                        '//footer//div[@contenteditable="true"]',
                        '//div[@data-testid="conversation-text-input"]',
                        '//div[contains(@class, "lexical-rich-text-input")]//div[@contenteditable="true"]',
                        '//p[contains(@class, "selectable-text") and contains(@class, "copyable-text")]'
                    ]

                    while time.time() - start_time < 60:
                        try:
                            # 1. Try to find the message box using multiple selectors
                            for xpath in box_selectors:
                                elements = driver.find_elements(By.XPATH, xpath)
                                if elements and elements[0].is_displayed():
                                    message_box = elements[0]
                                    # Ensure it's the correct one by checking for any parent footer
                                    break
                            
                            if message_box:
                                break
                            
                            # 2. Check specifically for the "Phone number shared via url is invalid" modal
                            page_text = driver.page_source.lower()
                            invalid_triggers = [
                                "phone number shared via url is invalid",
                                "url is invalid",
                                "is not on whatsapp",
                                "invalid number",
                                "couldn't find"
                            ]
                            
                            if any(trigger in page_text for trigger in invalid_triggers):
                                print(f"[{username}] ⚠️ Phone number {number} appears to be invalid on WhatsApp.")
                                break
                            
                            # 3. Check for "Starting chat" overlay that might be stuck
                            if "starting chat" in page_text:
                                # If stuck for too long, maybe refresh? But for now just wait
                                pass

                            time.sleep(2)
                        except Exception as e:
                            print(f"Polling error: {e}")
                            time.sleep(2)

                    if not message_box:
                        # Log more info about why it failed
                        print(f"[{username}] 🔍 Debug Info: URL={driver.current_url}, Title={driver.title}")
                        raise Exception("Message box not found (Possible invalid number, slow connection, or DOM change)")

                    time.sleep(2.5) # Extra safety for cloud environment
                    
                    # Ensure focus using JavaScript before typing
                    try:
                        driver.execute_script("arguments[0].focus();", message_box)
                    except:
                        pass
                        
                    message_box.click()
                    time.sleep(0.5)
                    type_message_with_newlines(driver, message_box, message)
                    time.sleep(1.0)
                    message_box.send_keys(Keys.ENTER)
                    
                    # Confirm send
                    wait_for_message_to_send(driver, send_wait)
                    
                    print(f"[{username}] ✅ Message sent to {name}")
                    results["sent_count"] += 1
                    if on_status:
                        on_status(contact, "Sent")
                    
                    # 15-SECOND DELAY ENFORCEMENT
                    # Calculate how much time is left to reach 15 seconds for this contact
                    elapsed = time.time() - contact_start_time
                    if elapsed < 15:
                        remaining = 15 - elapsed
                        print(f"[{username}] ⏳ Waiting {remaining:.1f}s to maintain 15s interval...")
                        time.sleep(remaining)

                except Exception as e:
                    print(f"[{username}] ❌ Failed for {name}: {e}")
                    results["failed_count"] += 1
                    if on_status:
                        on_status(contact, "Failed")
                    
                    # Even if it fails, wait a bit to avoid hammering
                    time.sleep(5)

            # AFTER BATCH
            print(f"[{username}] ✅ Batch completed.")
            
            # Check if there are more contacts
            if i + 100 < total_contacts and results["status"] == "completed":
                # Notify cooldown for the next batch
                if broadcast_func:
                    broadcast_func({"type": "COOLDOWN_START", "data": {"seconds": 3600}})
                
                print(f"[{username}] 💤 Batch finished. Closing browser for 1-hour cooldown...")
                if driver:
                    driver.quit()
                    driver = None
                time.sleep(3600) # 1 hour wait
            elif results["status"] != "completed":
                break
        
        # Trigger cooldown even after the final batch is processed
        if results["sent_count"] > 0:
            if broadcast_func:
                broadcast_func({"type": "COOLDOWN_START", "data": {"seconds": 3600}})
            print("💤 Process finished. Final 1-hour cooldown started.")

        return results

    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass
        if broadcast_func:
            broadcast_func({"type": "PROCESS_FINISHED", "data": {}})
        print("✅ All scheduled messages processed")