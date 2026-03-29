with open('src/pages/Dashboard.tsx', 'r') as f:
    text = f.read()

bad_str = """            </motion.div>
          </div>
            </>
          )}

        </div>
      </TooltipProvider>"""

good_str = """            </motion.div>
              </>
            )}

          </div>

        </div>
      </TooltipProvider>"""

if bad_str in text:
    print("Found! Fixing")
    text = text.replace(bad_str, good_str)
    with open('src/pages/Dashboard.tsx', 'w') as f:
        f.write(text)
else:
    print("Not found")
